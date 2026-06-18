# HitsOnce — repo guide

Privacy-respecting, self-hostable web analytics. **One Cloudflare Worker** serves two roles
on different routes: the **first-party collector** (`/_stats` on each tracked domain) and the
**dashboard + API** (on the app domain). Conventions mirror `~/projects/fixtext`.

## Stack

- **Hono on Cloudflare Workers**, TypeScript + ESM. Imports use explicit `.ts` specifiers
  (Node type-stripping for scripts; wrangler bundles the Worker). No `.mjs`.
- **DB:** Postgres (Neon in prod) via **Cloudflare Hyperdrive** (`HYPERDRIVE` binding) using a
  standard `pg` driver. **Kysely** composes SQL. Migrations are raw SQL in `migrations/`,
  `YYYYMMDDHHMMSS-desc.sql`, applied in order — `npm run migrate:new -- "desc"`.
- **Local DB:** `docker compose up -d` (Postgres 18). Migrate with
  `DATABASE_URL=postgres://postgres:postgres@localhost:5432/hitsonce npm run migrate`.
- Deps pinned to exact versions (`.npmrc` `save-exact=true`).

## Backend architecture (three layers + context)

Requests flow **http → app → data**, with a context (`IContext`: `config`, `logger`, `db`,
`auth`) threaded as the first argument into every function.

- `src/http/` — Hono routes + middleware. Validates with Zod, builds the context, calls the
  **app layer only**.
- `src/app/` — business logic. Calls data-layer functions; never imports Hono or touches `ctx.db`.
- `src/data/` + `src/db/` — all SQL. **Kysely is confined here** (eslint forbids importing
  `kysely` elsewhere). `src/db/schema.ts` is the typed Kysely `Database`; keep it in sync with
  `migrations/`.

## Identity & privacy

- Default **cookieless**: `sha256(domain.salt + utcDay + ip + ua)` — no device storage, no banner.
- Optional per-domain **cookie mode** for cross-session accuracy (site owner owns consent).
- Geo is free from Cloudflare's edge (`request.cf`); never ship a third-party IP DB.

## Commands

- `npm run dev` — `wrangler dev`. `npm run deploy` — deploy the Worker.
- `npm run typecheck` / `npm run lint` / `npm run format:check`.
- `DATABASE_URL=… npm run migrate` — apply migrations.

## Conventions

- TypeScript everywhere; respect the layers. The context is always the first argument.
  Kysely never leaves `src/data` / `src/db`.
- `events` is range-partitioned by month; the daily cron (`create_events_month`) pre-creates
  the current + next month. A DEFAULT partition is the safety net.
- The collector is public (no auth). The dashboard/API is auth'd (Google OAuth, planned).
