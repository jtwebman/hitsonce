// Create a new migration with a UTC timestamp prefix:
//   npm run migrate:new -- "add events index"  ->  migrations/20260617..-add-events-index.sql
//
// Timestamp prefixes mean parallel work never collides on a sequence number, and
// migrations apply in alphabetical (= chronological) order.
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const desc = process.argv.slice(2).join(' ').trim();
if (!desc) {
  console.error('usage: npm run migrate:new -- "<description>"');
  process.exit(1);
}

const slug = desc
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const d = new Date();
const pad = (n: number): string => String(n).padStart(2, '0');
const ts =
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
  `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const name = `${ts}-${slug}.sql`;
const file = join(dir, name);
if (existsSync(file)) {
  console.error(`already exists: ${name}`);
  process.exit(1);
}

writeFileSync(file, `-- ${desc}\n-- Forward-only; keep additive/expand-contract.\n`);
console.log(`created migrations/${name}`);
