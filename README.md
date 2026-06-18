# HitsOnce

Privacy-respecting, self-hostable web analytics for [hitsonce.app](https://hitsonce.app).
Real users vs bots, unique visitors, geo / language / timezone / device — first-party,
no third-party cookies, banner-free by default.

One Cloudflare Worker does both jobs: the **first-party collector** (served on each tracked
site's own domain at `/_stats`) and the **dashboard + API** (on the app domain). Storage is
**Cloudflare D1** (SQLite) out of the box — self-host with one `wrangler d1 create`, no
external database — and pluggable behind a small `Store` interface.

## Stack

- **Hono on Cloudflare Workers**, TypeScript + ESM.
- **Storage** behind a `Store` interface (`src/data/store.ts`); built-in adapter is **D1**
  (`src/data/stores/d1.ts`). Implement `Store` + wire it in `src/data/createStore.ts` to use
  Postgres, Analytics Engine, etc.
- Backend is three layers — **http → app → data** — with a `context` (`config`, `logger`,
  `store`) threaded as the first argument. The app/http layers speak domain objects, never SQL.
- Migrations are SQL in `migrations/` (`wrangler d1 migrations`).
- Deps pinned to exact versions (`.npmrc` `save-exact=true`).

## Auth

The dashboard is gated by **Cloudflare Access** (Zero Trust) — allow access by email in the
Zero Trust dashboard; no user accounts, OAuth, or sessions in the app. Every allowed user has
full access to all domains (single shared account). The **collector is public** — never put
`/_stats` behind Access.

## Identity & privacy

- **Cookieless by default:** a server-side daily-rotating `sha256(salt + day + ip + ua)` per
  domain — nothing stored on the device, so no consent banner needed.
- **Optional per-domain cookie mode** for cross-session accuracy (the site owner owns consent).
- Geo (country / region / city / timezone) comes free from Cloudflare's edge (`request.cf`).

## Develop

```bash
npm install
npm run migrate:local       # apply migrations to the local D1
npm run dev                 # wrangler dev (simulates D1 locally)
```

`npm run typecheck` · `npm run lint` · `npm run format:check`.

## Embed the tracker

```html
<script src="/_stats" defer></script>
```

## Roadmap

- [x] D1 storage behind a pluggable `Store`; collector pipeline (ingest, geo, UA → device,
      bot detection, cookieless hash).
- [ ] Domains API + dashboard (visitors, uniques, top pages/referrers, geo, devices), behind
      Cloudflare Access.
- [ ] Optional Postgres / Analytics Engine `Store` adapters; per-site billing for hosted.

## License

AGPL-3.0 — see [LICENSE](./LICENSE).
