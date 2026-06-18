# HitsOnce — repo guide

Privacy-respecting, self-hostable web analytics. **One Cloudflare Worker** serves two roles by
route: the **first-party collector** (`/_stats` on each tracked domain, public) and the
**dashboard + API** (on the app domain, gated by Cloudflare Access). Layering conventions
mirror `~/projects/fixtext`; storage is intentionally pluggable.

## Stack

- **Hono on Cloudflare Workers**, TypeScript + ESM. Imports use explicit `.ts` specifiers. No `.mjs`.
- **Storage:** a `Store` interface (`src/data/store.ts`) backed by **Cloudflare D1** (SQLite)
  in `src/data/stores/d1.ts`. `src/data/createStore.ts` is the one place that picks a backend —
  implement `Store` to add Postgres / Analytics Engine / etc. The app/http layers speak domain
  objects (camelCase), never SQL.
- **Migrations:** SQL in `migrations/` applied with `wrangler d1 migrations apply` (D1 tracks
  applied files). `npm run migrate:local` (dev) / `npm run migrate` (remote).
- Deps pinned to exact versions (`.npmrc` `save-exact=true`).

## Backend architecture (three layers + context)

Requests flow **http → app → data**, with a context (`IContext`: `config`, `logger`, `store`)
threaded as the first argument.

- `src/http/` — Hono routes + middleware. Validates with Zod, builds the context, calls the
  **app layer only**.
- `src/app/` — business logic. Calls `ctx.store.*`; never touches a storage backend directly.
- `src/data/` — the `Store` interface + adapters (`stores/`). SQL/backend specifics live here.

## Auth & tenancy

- The dashboard is gated by **Cloudflare Access** (email allowlist in Zero Trust). No
  user/account tables, no OAuth, no sessions. A protected route reads the verified email from
  the `Cf-Access-Jwt-Assertion` header (verify against the team JWKS + `aud`).
- **Single shared account:** every allowed user has full access to all domains.
- The collector is **public** — never behind Access.

## Identity & privacy

- Default **cookieless**: `sha256(domain.salt + utcDay + ip + ua)` — no device storage, no banner.
- Optional per-domain **cookie mode** for cross-session accuracy (site owner owns consent).
- Geo is free from Cloudflare's edge (`request.cf`); never ship a third-party IP DB.

## Commands

- `npm run dev` — `wrangler dev`. `npm run deploy` — deploy the Worker.
- `npm run typecheck` / `npm run lint` / `npm run format:check`.
- `npm run migrate:local` / `npm run migrate` — apply D1 migrations.
