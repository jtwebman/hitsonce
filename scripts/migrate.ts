// Forward-only migration runner. Applies pending migrations/*.sql in alphabetical
// order, each in its own transaction, tracking applied files in a _migrations table.
// Files are named `YYYYMMDDHHMMSS-description.sql` (timestamp prefix) so parallel
// work never collides on a sequence number; create one with `npm run migrate:new`.
//
//   DATABASE_URL=postgres://... npm run migrate
//
// Runs under Node's built-in TypeScript support (type stripping) — no build step.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DATABASE_URL: string | undefined = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

try {
  await client.query(
    'create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  const { rows } = await client.query<{ name: string }>('select name from _migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`apply  ${file}`);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into _migrations (name) values ($1)', [file]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      console.error(`failed ${file}:`, err);
      process.exit(1);
    }
  }
  console.log('migrations up to date');
} finally {
  await client.end();
}
