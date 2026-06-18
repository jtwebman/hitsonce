# HitsOnce

Self-hosted, open-source web analytics you run on your own Cloudflare account.
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

## Deploy your own

HitsOnce is meant to be self-hosted on **your** Cloudflare account, so the data stays yours.

1. **Clone + install:**
   ```bash
   git clone https://github.com/jtwebman/hitsonce && cd hitsonce && npm install
   ```
2. **Create the database** and paste the printed `database_id` into `[[d1_databases]]` in
   `wrangler.toml`:
   ```bash
   npx wrangler d1 create hitsonce
   ```
3. **Use your account:** set `account_id` in `wrangler.toml` to your own Cloudflare account id
   (the committed value is the original author's, kept only as a deploy guard).
4. **Apply the schema:** `npm run migrate`
5. **Pick a dashboard hostname** — its own domain or a subdomain (e.g. `stats.yourdomain.com`) —
   and add it as a custom-domain route in `wrangler.toml`:
   ```toml
   routes = [{ pattern = "stats.yourdomain.com", custom_domain = true }]
   ```
6. **Gate it with Cloudflare Access** (Zero Trust): create a self-hosted Access application
   covering `stats.yourdomain.com/dashboard` and `/api`, allow your email, then set in
   `wrangler.toml` `[vars]`:
   ```toml
   ACCESS_TEAM_DOMAIN = "yourteam.cloudflareaccess.com"
   ACCESS_AUD = "<your Access application AUD tag>"
   ```
   Without these the dashboard fails closed in production (stays locked), so it's never public.
7. **Deploy:** `npm run deploy`, then open `https://stats.yourdomain.com` and log in via Access.

## Embed the tracker

Add this to every page (e.g. SvelteKit `src/app.html`). It loads the first-party
tracker in production and **skips localhost**, so local dev has no 404s:

```html
<script>
  (function () {
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return;
    var s = document.createElement('script');
    s.src = '/_stats';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

### Custom events

`hitsonce(name, value?)` is defined once the tracker loads (production only). **Guard
calls** so they no-op in local dev:

```js
window.hitsonce?.('timer_start', 45); // value optional, e.g. minutes set
window.hitsonce?.('timer_finish', 45);
window.hitsonce?.('breath_cycle'); // no value
```

Each shows up in the dashboard's Events panel, tallied by name and broken down by value.

## Track a new site

The tracked hostname can be any domain or **subdomain** whose Cloudflare zone is in your account.

1. **Route `/_stats` to the Worker** in `wrangler.toml`, then `npm run deploy`:
   ```toml
   { pattern = "example.com/_stats", zone_name = "example.com" }
   ```
   Only `/_stats` is routed to HitsOnce; the rest of the site is untouched.
2. **Register the domain** — one row in D1, with a random salt for the cookieless hash:
   ```bash
   npx wrangler d1 execute hitsonce --remote --command \
     "insert into domains (id, hostname, salt) values ('$(uuidgen | tr A-Z a-z)', 'example.com', '$(openssl rand -hex 16)')"
   ```
3. **Embed the snippet** (see "Embed the tracker") on the site and deploy it. Pageviews flow
   automatically; fire custom events with `window.hitsonce?.(name, value?)`.

## Hardening

The collector at `/_stats` is intentionally **public** — it has to accept beacons from
anyone visiting a tracked page. Keep it safe:

- **Rate-limit `/_stats`.** Add a Cloudflare **Rate Limiting** rule on each tracked zone,
  matching path `/_stats` — e.g. **500 requests / 1 hour / per IP**, action _Block_. It runs
  at the edge before the Worker, so it costs nothing and caps flooding. **Strongly recommended
  for any self-hosted deployment.**
- **Batched writes.** The collector enqueues events and a queue consumer bulk-inserts them, so
  a traffic spike becomes a few batched D1 writes instead of one per hit (Queues require the
  Workers Paid plan; without the binding the collector falls back to direct writes).

Beacons are forgeable (true of any client-side analytics) — the rate limit, plus optional
Origin/Referer checks, are the practical defense. Treat the numbers as "good enough," not
audit-grade.

## Roadmap

- [x] D1 storage behind a pluggable `Store`; collector pipeline (ingest, geo, UA → device,
      bot detection, cookieless hash).
- [x] Domains + stats API behind Cloudflare Access.
- [x] Dashboard UI (visitors, uniques, top pages/referrers, geo, devices).
- [x] Custom events with optional values.
- [ ] Optional Postgres / Analytics Engine `Store` adapters.

## License

AGPL-3.0 — see [LICENSE](./LICENSE).
