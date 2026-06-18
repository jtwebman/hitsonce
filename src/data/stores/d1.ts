import type { Domain, NewDomain, NewEvent, Store } from '../store.ts';

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

    async insertEvent(e: NewEvent): Promise<void> {
      await db
        .prepare(
          `insert into events
            (id, domain_id, visitor_hash, name, path, referrer_host, country, region,
             city, timezone, language, browser, os, device, screen_w, screen_h, is_bot)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          e.domainId,
          e.visitorHash,
          e.name,
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
        )
        .run();
    },
  };
}
