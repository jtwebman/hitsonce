import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createD1Store } from '../src/data/stores/d1.ts';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

// A tiny D1-compatible shim over better-sqlite3 so the tests drive the REAL adapter
// SQL (the same prepare/bind/run/all/first/batch surface the D1 binding exposes)
// against a real SQLite engine. If the adapter's SQL is wrong, these tests catch it.
function d1(db) {
  class Stmt {
    constructor(sql, args) {
      this.sql = sql;
      this.args = args ?? [];
    }
    bind(...args) {
      return new Stmt(this.sql, args);
    }
    async run() {
      const info = db.prepare(this.sql).run(...this.args);
      return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
    }
    async all() {
      return { success: true, results: db.prepare(this.sql).all(...this.args) };
    }
    async first(col) {
      const row = db.prepare(this.sql).get(...this.args);
      if (row == null) return null;
      return col === undefined ? row : (row[col] ?? null);
    }
  }
  return {
    prepare(sql) {
      return new Stmt(sql);
    },
    // D1's batch runs the statements in one transaction, in order.
    async batch(stmts) {
      const tx = db.transaction((list) => list.map((s) => db.prepare(s.sql).run(...s.args)));
      tx(stmts);
      return stmts.map(() => ({ success: true, results: [] }));
    },
  };
}

// Fresh in-memory database with all migrations applied + the real D1 store on top.
export function makeStore() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
  // Every event references this domain (events.domain_id is a FK to domains.id).
  db.prepare('insert into domains (id, hostname, salt) values (?, ?, ?)').run(
    'dom1',
    'example.com',
    'test-salt',
  );
  return { db, store: createD1Store(d1(db)) };
}

// 'YYYY-MM-DD HH:MM:SS' for a time `minutes` before now (matches how `ts` is stored).
export function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString().slice(0, 19).replace('T', ' ');
}

// 'YYYY-MM-DD HH:MM:SS' for a time `days` before now.
export function daysAgo(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
}

// The grain bucket a timestamp falls into, computed the same way the adapter's SQL does
// (floor the UTC epoch to a multiple of `secs`), so tests can assert exact bucket rows.
export function bucketOf(ts, secs) {
  const epoch = Math.floor(Date.parse(ts.replace(' ', 'T') + 'Z') / 1000);
  const aligned = Math.floor(epoch / secs) * secs;
  return new Date(aligned * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

// Insert one raw event at an explicit timestamp. Sensible nullable defaults so each
// test only specifies the columns it cares about.
export function insertRaw(db, e) {
  db.prepare(
    `insert into events
       (id, domain_id, ts, visitor_hash, name, value, path, referrer_host, country,
        region, city, timezone, language, browser, os, device, screen_w, screen_h, is_bot)
     values
       (@id, @domain_id, @ts, @visitor_hash, @name, @value, @path, @referrer_host, @country,
        @region, @city, @timezone, @language, @browser, @os, @device, @screen_w, @screen_h, @is_bot)`,
  ).run({
    domain_id: 'dom1',
    name: 'pageview',
    value: null,
    path: null,
    referrer_host: null,
    country: null,
    region: null,
    city: null,
    timezone: null,
    language: null,
    browser: null,
    os: null,
    device: null,
    screen_w: null,
    screen_h: null,
    is_bot: 0,
    ...e,
  });
}
