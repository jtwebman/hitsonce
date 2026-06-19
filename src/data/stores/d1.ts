import type {
  CountBucket,
  Domain,
  NewDomain,
  NewEvent,
  Stats,
  StatsQuery,
  Store,
} from '../store.ts';
import { dayStartUTC } from '../../lib/time.ts';

// Built-in storage adapter: Cloudflare D1 (SQLite at the edge). One `wrangler d1
// create` to self-host — no external database. Maps snake_case rows ↔ camelCase
// domain objects so the rest of the app never sees SQL.

interface DomainRow {
  id: string;
  hostname: string;
  collector_path: string;
  identity_mode: string;
  salt: string;
  created_at: string;
}

const DOMAIN_COLS = 'id, hostname, collector_path, identity_mode, salt, created_at';

function toDomain(r: DomainRow): Domain {
  return {
    id: r.id,
    hostname: r.hostname,
    collectorPath: r.collector_path,
    identityMode: r.identity_mode === 'cookie' ? 'cookie' : 'cookieless',
    salt: r.salt,
    createdAt: r.created_at,
  };
}

// ISO-8601 (e.g. 2026-06-17T12:00:00.000Z) → SQLite's 'YYYY-MM-DD HH:MM:SS' so it
// compares directly against `ts` (stored via datetime('now')) and uses the index.
function toSqlite(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ');
}

const INSERT_EVENT_SQL = `insert or ignore into events
  (id, domain_id, visitor_hash, name, value, path, referrer_host, country, region,
   city, timezone, language, browser, os, device, screen_w, screen_h, is_bot)
 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// Bind a NewEvent to the insert statement. The id is supplied (not generated here)
// so a retried queue message inserts the same row and INSERT OR IGNORE dedupes it.
function bindEvent(stmt: D1PreparedStatement, e: NewEvent): D1PreparedStatement {
  return stmt.bind(
    e.id,
    e.domainId,
    e.visitorHash,
    e.name,
    e.value,
    e.path,
    e.referrerHost,
    e.country,
    e.region,
    e.city,
    e.timezone,
    e.language,
    e.browser,
    e.os,
    e.device,
    e.screenW,
    e.screenH,
    e.isBot ? 1 : 0,
  );
}

export function createD1Store(db: D1Database): Store {
  return {
    async ping(): Promise<boolean> {
      try {
        await db.prepare('select 1').first();
        return true;
      } catch {
        return false;
      }
    },

    async getDomainByHost(hostname: string): Promise<Domain | null> {
      const row = await db
        .prepare(`select ${DOMAIN_COLS} from domains where hostname = ?`)
        .bind(hostname)
        .first<DomainRow>();
      return row ? toDomain(row) : null;
    },

    async listDomains(): Promise<Domain[]> {
      const { results } = await db
        .prepare(`select ${DOMAIN_COLS} from domains order by hostname`)
        .all<DomainRow>();
      return results.map(toDomain);
    },

    async createDomain(input: NewDomain): Promise<Domain> {
      const row = await db
        .prepare(
          `insert into domains (id, hostname, collector_path, identity_mode, salt)
           values (?, ?, ?, ?, ?)
           returning ${DOMAIN_COLS}`,
        )
        .bind(
          crypto.randomUUID(),
          input.hostname,
          input.collectorPath ?? '/_stats',
          input.identityMode ?? 'cookieless',
          input.salt,
        )
        .first<DomainRow>();
      if (!row) throw new Error('createDomain: insert returned no row');
      return toDomain(row);
    },

    async deleteDomain(id: string): Promise<void> {
      await db.prepare('delete from domains where id = ?').bind(id).run();
    },

    async insertEvent(e: NewEvent): Promise<void> {
      await bindEvent(db.prepare(INSERT_EVENT_SQL), e).run();
    },

    async insertEvents(events: NewEvent[]): Promise<void> {
      if (!events.length) return;
      const stmt = db.prepare(INSERT_EVENT_SQL);
      await db.batch(events.map((e) => bindEvent(stmt, e)));
    },

    async getStats(q: StatsQuery): Promise<Stats> {
      const from = toSqlite(q.from);
      const to = toSqlite(q.to);
      const botClause = q.includeBots ? '' : ' and is_bot = 0';
      const args = [q.domainId, from, to] as const;
      const base = `where domain_id = ? and ts >= ? and ts < ?${botClause}`;
      // Audience metrics count pageviews only; custom events are tallied separately.
      const pv = `${base} and name = 'pageview'`;

      const totals = await db
        .prepare(`select count(*) as pv from events ${pv}`)
        .bind(...args)
        .first<{ pv: number }>();

      // Unique visitors over a rolling 24h window. Cookieless hashes rotate daily, so
      // this is the meaningful unique figure — cross-day/range totals would just sum
      // daily uniques. Real humans only (pageviews, non-bot).
      const cutoff24 = toSqlite(new Date(Date.now() - 86_400_000).toISOString());
      const u24 = await db
        .prepare(
          `select count(distinct visitor_hash) as u from events
           where domain_id = ? and name = 'pageview' and is_bot = 0 and ts >= ?`,
        )
        .bind(q.domainId, cutoff24)
        .first<{ u: number }>();

      const day = await db
        .prepare(
          `select date(ts) as day, count(*) as pv, count(distinct visitor_hash) as uv
           from events ${pv} group by date(ts) order by day`,
        )
        .bind(...args)
        .all<{ day: string; pv: number; uv: number }>();

      // `col` is one of a fixed internal set of column names — never user input.
      const top = async (col: string): Promise<CountBucket[]> => {
        const { results } = await db
          .prepare(
            `select ${col} as k, count(*) as c from events ${pv}
             and ${col} is not null and ${col} <> '' group by ${col} order by c desc limit 10`,
          )
          .bind(...args)
          .all<{ k: string; c: number }>();
        return results.map((r) => ({ key: r.k, count: r.c }));
      };

      // Custom (non-pageview) events, tallied by name + value.
      const customRows = await db
        .prepare(
          `select name as name, value as value, count(*) as c from events ${base}
           and name <> 'pageview' group by name, value order by name asc, c desc limit 100`,
        )
        .bind(...args)
        .all<{ name: string; value: string | null; c: number }>();

      return {
        pageviews: totals?.pv ?? 0,
        uniques24h: u24?.u ?? 0,
        byDay: day.results.map((r) => ({ day: r.day, pageviews: r.pv, visitors: r.uv })),
        topPages: await top('path'),
        topReferrers: await top('referrer_host'),
        countries: await top('country'),
        devices: await top('device'),
        browsers: await top('browser'),
        customEvents: customRows.results.map((r) => ({
          name: r.name,
          value: r.value,
          count: r.c,
        })),
      };
    },

    async pruneEventsBefore(cutoff: string): Promise<number> {
      const res = await db.prepare('delete from events where ts < ?').bind(toSqlite(cutoff)).run();
      return res.meta.changes ?? 0;
    },

    async maintainRollups(timezone: string): Promise<void> {
      const now = Date.now();
      const dims: [string, string][] = [
        ['path', 'path'],
        ['referrer', 'referrer_host'],
        ['country', 'country'],
        ['device', 'device'],
        ['browser', 'browser'],
      ];
      // INSERT OR REPLACE (no delete) is idempotent here because raw is append-only
      // within the reroll window: each run recomputes every touched bucket from raw
      // and overwrites it, late/queued events get picked up, and no bucket can lose
      // events — so nothing goes stale. Buckets outside the window stay finalized.
      const stmts: D1PreparedStatement[] = [];

      // Fixed-width tiers (5m, 1h): timezone-independent. Bucket = ts floored to the
      // grain. Re-aggregate a recent window so late/queued events are caught.
      const fixed = [
        { grain: '5m', secs: 300, reroll: 2 * 3600 },
        { grain: '1h', secs: 3600, reroll: 6 * 3600 },
      ];
      for (const g of fixed) {
        const grainMs = g.secs * 1000;
        // Align the window start to the grain so boundary buckets aggregate fully.
        const from = toSqlite(
          new Date(Math.floor((now - g.reroll * 1000) / grainMs) * grainMs).toISOString(),
        );
        // `g.secs` is an internal numeric constant; never user input.
        const bucket = `datetime((cast(strftime('%s', ts) as integer) / ${g.secs}) * ${g.secs}, 'unixepoch')`;
        stmts.push(
          db
            .prepare(
              `insert or replace into rollup_totals (domain_id, grain, bucket, pageviews, uniques)
               select domain_id, ?, ${bucket},
                      sum(case when name = 'pageview' then 1 else 0 end),
                      count(distinct case when name = 'pageview' then visitor_hash end)
               from events where is_bot = 0 and ts >= ?
               group by domain_id, ${bucket}`,
            )
            .bind(g.grain, from),
        );
        for (const [dim, col] of dims) {
          stmts.push(
            db
              .prepare(
                `insert or replace into rollup_dim (domain_id, grain, bucket, dim, key, count)
                 select domain_id, ?, ${bucket}, ?, ${col}, count(*)
                 from events
                 where is_bot = 0 and name = 'pageview' and ts >= ? and ${col} is not null and ${col} <> ''
                 group by domain_id, ${bucket}, ${col}`,
              )
              .bind(g.grain, dim, from),
          );
        }
        stmts.push(
          db
            .prepare(
              `insert or replace into rollup_event (domain_id, grain, bucket, name, value, count)
               select domain_id, ?, ${bucket}, name, coalesce(value, ''), count(*)
               from events where is_bot = 0 and name <> 'pageview' and ts >= ?
               group by domain_id, ${bucket}, name, value`,
            )
            .bind(g.grain, from),
        );
      }

      // Daily tier: bucket by civil day in `timezone`. SQLite can't apply IANA tz
      // rules, so enumerate the civil days the reroll window spans (~3) and roll each
      // over an explicit [dayStart, nextDayStart) UTC range. The stored bucket is the
      // UTC instant the civil day began — DST-aware (a transition day is 23h/25h) and
      // needing no per-event column.
      let cursor = dayStartUTC(new Date(now - 50 * 3600 * 1000), timezone);
      while (cursor.getTime() <= now) {
        // +26h then re-derive lands in the next civil day across any DST gap/overlap.
        const next = dayStartUTC(new Date(cursor.getTime() + 26 * 3600 * 1000), timezone);
        const lo = toSqlite(cursor.toISOString());
        const hi = toSqlite(next.toISOString());
        stmts.push(
          db
            .prepare(
              `insert or replace into rollup_totals (domain_id, grain, bucket, pageviews, uniques)
               select domain_id, '1d', ?,
                      sum(case when name = 'pageview' then 1 else 0 end),
                      count(distinct case when name = 'pageview' then visitor_hash end)
               from events where is_bot = 0 and ts >= ? and ts < ?
               group by domain_id`,
            )
            .bind(lo, lo, hi),
        );
        for (const [dim, col] of dims) {
          stmts.push(
            db
              .prepare(
                `insert or replace into rollup_dim (domain_id, grain, bucket, dim, key, count)
                 select domain_id, '1d', ?, ?, ${col}, count(*)
                 from events
                 where is_bot = 0 and name = 'pageview' and ts >= ? and ts < ? and ${col} is not null and ${col} <> ''
                 group by domain_id, ${col}`,
              )
              .bind(lo, dim, lo, hi),
          );
        }
        stmts.push(
          db
            .prepare(
              `insert or replace into rollup_event (domain_id, grain, bucket, name, value, count)
               select domain_id, '1d', ?, name, coalesce(value, ''), count(*)
               from events where is_bot = 0 and name <> 'pageview' and ts >= ? and ts < ?
               group by domain_id, name, value`,
            )
            .bind(lo, lo, hi),
        );
        cursor = next;
      }

      await db.batch(stmts);
    },

    async pruneRollups(): Promise<void> {
      const cut5m = toSqlite(new Date(Date.now() - 30 * 86_400_000).toISOString());
      const cut1h = toSqlite(new Date(Date.now() - 90 * 86_400_000).toISOString());
      await db.batch([
        db.prepare("delete from rollup_totals where grain = '5m' and bucket < ?").bind(cut5m),
        db.prepare("delete from rollup_dim where grain = '5m' and bucket < ?").bind(cut5m),
        db.prepare("delete from rollup_event where grain = '5m' and bucket < ?").bind(cut5m),
        db.prepare("delete from rollup_totals where grain = '1h' and bucket < ?").bind(cut1h),
        db.prepare("delete from rollup_dim where grain = '1h' and bucket < ?").bind(cut1h),
        db.prepare("delete from rollup_event where grain = '1h' and bucket < ?").bind(cut1h),
      ]);
    },
  };
}
