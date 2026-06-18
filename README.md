# HitsOnce

Privacy-respecting, self-hostable web analytics for [hitsonce.app](https://hitsonce.app).
Real users vs bots, unique visitors, geo / language / timezone / device — first-party,
no third-party cookies, banner-free by default.

One Cloudflare Worker does both jobs: the **first-party collector** (served on each
tracked site's own domain at `/_stats`) and the **dashboard + API** (on the app domain).
Postgres (Neon in prod) via Cloudflare Hyperdrive.

## Stack

- **Hono on Cloudflare Workers**, TypeScript + ESM.
- **Postgres** via **Hyperdrive** using the standard `pg` driver; **Kysely** composes SQL.
- Backend is three layers — **http → app → data** — with a `context` (`config`, `logger`,
  `db`) threaded as the first argument. Kysely is confined to `src/data` / `src/db`.
- Migrations are raw SQL in `migrations/`, `YYYYMMDDHHMMSS-desc.sql`, applied in order.
- Deps pinned to exact versions (`.npmrc` `save-exact=true`).

## Identity & privacy

- **Cookieless by default:** a server-side daily-rotating `sha256(salt + day + ip + ua)`
  per domain — no cookie, nothing stored on the device, so no consent banner needed.
- **Optional per-domain cookie mode** (`identity_mode = 'cookie'`) for cross-session
  accuracy where the site owner handles consent.
- Geo (country / region / city / timezone) comes free from Cloudflare's edge (`request.cf`) —
  no third-party IP database.

## Develop

```bash
docker compose up -d        # local Postgres 18
npm install
DATABASE_URL=postgres://postgres:postgres@localhost:5432/hitsonce npm run migrate
npm run dev                 # wrangler dev (Worker on :8787)
```

`npm run typecheck` · `npm run lint` · `npm run format:check`.

## Embed the tracker

Add one line to a tracked site (served first-party from its own domain):

```html
<script src="/_stats" defer></script>
```

## Roadmap

- [x] Collector pipeline (ingest, geo, UA → device, bot detection, cookieless hash).
- [ ] Google OAuth login; accounts / domains management API.
- [ ] Dashboard (visitors, uniques, top pages/referrers, geo, devices).
- [ ] Per-site Stripe billing for the hosted version.

## License

AGPL-3.0 — see [LICENSE](./LICENSE).
