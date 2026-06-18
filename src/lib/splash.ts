// Public marketing/splash page at `/` (not gated). The dashboard lives at /dashboard
// behind Cloudflare Access; "Log in" points at /login, which bounces to /dashboard
// and triggers the Access flow.
export function renderSplash(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>HitsOnce — open-source web analytics you own</title>
<meta name="description" content="Privacy-first, self-hosted web analytics on Cloudflare. First-party, cookieless by default, no consent banner. Real humans vs bots, geo, devices, referrers. Open source." />
<style>
  :root { color-scheme: light dark; --bg:#0b0c10; --fg:#e6e8eb; --muted:#9aa3ad; --card:#15171c; --line:#262a31; --accent:#4c8dff; }
  @media (prefers-color-scheme: light) { :root { --bg:#f6f7f9; --fg:#16181d; --muted:#5b636d; --card:#fff; --line:#e3e6ea; --accent:#2f6fed; } }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--fg); }
  header { display:flex; align-items:center; justify-content:space-between; padding:1.1rem 1.5rem; border-bottom:1px solid var(--line); }
  header .brand { font-weight:700; }
  header nav a { color:var(--fg); text-decoration:none; margin-left:1.25rem; }
  header nav a:hover { color:var(--accent); }
  .hero { max-width:760px; margin:0 auto; padding:5rem 1.5rem 3rem; text-align:center; }
  .hero h1 { font-size:2.6rem; line-height:1.15; margin:0 0 1rem; }
  .hero p { font-size:1.2rem; color:var(--muted); margin:0 auto 2rem; max-width:600px; }
  .btns { display:flex; gap:.75rem; justify-content:center; flex-wrap:wrap; }
  .btn { display:inline-block; padding:.7rem 1.3rem; border-radius:10px; text-decoration:none; font-weight:600; border:1px solid var(--line); color:var(--fg); }
  .btn.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
  .features { max-width:920px; margin:0 auto; padding:1rem 1.5rem 5rem; display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:1rem; }
  .feature { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:1.25rem; }
  .feature h3 { margin:0 0 .4rem; font-size:1.05rem; }
  .feature p { margin:0; color:var(--muted); font-size:.95rem; }
  footer { border-top:1px solid var(--line); padding:1.5rem; text-align:center; color:var(--muted); font-size:.9rem; }
  footer a { color:var(--accent); text-decoration:none; }
</style>
</head>
<body>
<header>
  <span class="brand">HitsOnce</span>
  <nav>
    <a href="https://github.com/jtwebman/hitsonce">GitHub</a>
    <a href="/login">Log in</a>
  </nav>
</header>
<section class="hero">
  <h1>Web analytics you actually own.</h1>
  <p>
    Privacy-first, self-hosted analytics that runs on your own Cloudflare account.
    First-party, cookieless by default, no consent banner — and fully open source.
  </p>
  <div class="btns">
    <a class="btn primary" href="https://github.com/jtwebman/hitsonce">Get it on GitHub</a>
  </div>
</section>
<section class="features">
  <div class="feature"><h3>First-party</h3><p>The tracker is served from your own domain — no third-party cookies, no ad-blocker bait.</p></div>
  <div class="feature"><h3>No cookie banner</h3><p>Cookieless by default: a daily-rotating server-side hash, nothing stored on the device.</p></div>
  <div class="feature"><h3>Humans vs bots</h3><p>Bots are detected and separated, so your numbers reflect real visitors.</p></div>
  <div class="feature"><h3>The data that matters</h3><p>Unique visitors, pageviews, top pages and referrers, country, device, and browser.</p></div>
  <div class="feature"><h3>Runs on Cloudflare</h3><p>One Worker plus D1 (SQLite). Free edge geolocation, one-command self-host.</p></div>
  <div class="feature"><h3>Open source</h3><p>AGPL-3.0. Read it, run it, change it — your data stays yours.</p></div>
</section>
<footer>Self-hosted, open source. <a href="https://github.com/jtwebman/hitsonce">github.com/jtwebman/hitsonce</a></footer>
</body>
</html>`;
}
