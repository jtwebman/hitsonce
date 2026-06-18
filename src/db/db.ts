import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Env } from '../env.ts';
import type { Database } from './schema.ts';

// `Db` is the request-scoped query interface carried on the context. It is a
// Kysely instance, but Kysely (and any direct DB access) is DATA-LAYER ONLY —
// the app/http layers call functions in src/data/, never ctx.db. The ESLint
// config forbids importing `kysely` outside src/data and src/db.
export type Db = Kysely<Database>;

// Connects through Hyperdrive (which pools the real Postgres connections). The pg
// pool is lazy, so creating this with an empty string (no binding) is cheap; it
// only connects when a query actually runs.
export function createDb(connectionString: string): Db {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString, max: 5 }),
    }),
  });
}

// The Postgres connection string from the Hyperdrive binding.
export function mainConnectionString(env: Env): string {
  return env.HYPERDRIVE?.connectionString ?? '';
}
