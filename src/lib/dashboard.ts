const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);
}

// The dashboard is a single self-contained page (no build step). It's served behind
// Cloudflare Access and calls the same-origin /api/* endpoints. The client script
// uses string concatenation (no backticks / ${}) so it nests safely in this
// template literal. The only server-injected value is the signed-in email.
export function renderDashboard(email: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>HitsOnce</title>
<style>
  :root { color-scheme: light dark; --bg:#0b0c10; --fg:#e6e8eb; --muted:#9aa3ad; --card:#15171c; --line:#262a31; --accent:#4c8dff; }
  @media (prefers-color-scheme: light) { :root { --bg:#f6f7f9; --fg:#16181d; --muted:#5b636d; --card:#fff; --line:#e3e6ea; --accent:#2f6fed; } }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--fg); }
  header { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.25rem; border-bottom:1px solid var(--line); }
  header h1 { font-size:1.15rem; margin:0; }
  .who { color:var(--muted); font-size:.85rem; }
  main { max-width:1000px; margin:0 auto; padding:1.25rem; }
  .controls { display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; margin-bottom:1.25rem; }
  select, button, input { font:inherit; padding:.45rem .6rem; border-radius:8px; border:1px solid var(--line); background:var(--card); color:var(--fg); }
  button { cursor:pointer; }
  button.danger { color:#e5534b; border-color:#e5534b55; margin-top:1.5rem; }
  .cards { display:flex; gap:1rem; flex-wrap:wrap; }
  .card { flex:1; min-width:160px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:1rem 1.25rem; }
  .num { font-size:2rem; font-weight:700; }
  .lbl { color:var(--muted); font-size:.85rem; }
  .embed { margin:1rem 0; color:var(--muted); font-size:.85rem; }
  .embed code { background:var(--card); border:1px solid var(--line); border-radius:6px; padding:.15rem .4rem; color:var(--fg); }
  .chart { display:flex; align-items:flex-end; gap:2px; height:120px; margin:1.25rem 0; padding:.5rem; background:var(--card); border:1px solid var(--line); border-radius:12px; }
  .chart .col { flex:1; display:flex; align-items:flex-end; height:100%; }
  .chart .fill { width:100%; background:var(--accent); border-radius:2px 2px 0 0; min-height:2px; }
  .grids { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1rem; }
  .panel { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:1rem 1.25rem; }
  .panel h3 { margin:0 0 .75rem; font-size:.95rem; }
  .row { display:grid; grid-template-columns:1fr auto; align-items:center; gap:.5rem; position:relative; padding:.3rem 0; }
  .row .k { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; z-index:1; }
  .row .c { color:var(--muted); font-variant-numeric:tabular-nums; z-index:1; }
  .row .bar { position:absolute; left:0; top:.25rem; bottom:.25rem; background:var(--accent); opacity:.15; border-radius:4px; }
  .muted { color:var(--muted); }
  .evt { margin-bottom:.9rem; }
  .evt-h { font-weight:600; margin-bottom:.25rem; }
</style>
</head>
<body>
<header><h1>HitsOnce</h1><div class="who">${escapeHtml(email)} · <a href="/cdn-cgi/access/logout" style="color:inherit">Log out</a></div></header>
<main>
  <div class="controls">
    <select id="domain"></select>
    <select id="range">
      <option value="7">Last 7 days</option>
      <option value="30" selected>Last 30 days</option>
      <option value="90">Last 90 days</option>
    </select>
  </div>
  <section id="empty" class="muted" hidden>No domains configured yet.</section>
  <section id="stats" hidden>
    <div class="cards">
      <div class="card"><div class="num" id="uv">–</div><div class="lbl">Unique visitors</div></div>
      <div class="card"><div class="num" id="pv">–</div><div class="lbl">Pageviews</div></div>
    </div>
    <div class="embed">Embed on your site: <code id="embed"></code></div>
    <div class="chart" id="byday"></div>
    <div class="grids">
      <div class="panel"><h3>Top pages</h3><div id="pages"></div></div>
      <div class="panel"><h3>Referrers</h3><div id="refs"></div></div>
      <div class="panel"><h3>Countries</h3><div id="countries"></div></div>
      <div class="panel"><h3>Devices</h3><div id="devices"></div></div>
      <div class="panel"><h3>Browsers</h3><div id="browsers"></div></div>
    </div>
    <div class="panel" style="margin-top:1rem"><h3>Events</h3><div id="events"></div></div>
    <button id="del" class="danger">Delete domain</button>
  </section>
</main>
<script>
  var $ = function (id) { return document.getElementById(id); };
  var domains = [];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  async function api(path, opts) {
    var r = await fetch(path, opts);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.status === 204 ? null : r.json();
  }
  function bars(rows) {
    if (!rows.length) return '<div class="muted">No data</div>';
    var max = rows.reduce(function (m, r) { return Math.max(m, r.count); }, 1);
    return rows.map(function (r) {
      var w = ((r.count / max) * 100).toFixed(1);
      return '<div class="row"><span class="bar" style="width:' + w + '%"></span>' +
        '<span class="k" title="' + esc(r.key) + '">' + esc(r.key) + '</span>' +
        '<span class="c">' + r.count + '</span></div>';
    }).join('');
  }
  function eventsHtml(rows) {
    if (!rows.length) return '<div class="muted">No events yet</div>';
    var byName = {}, order = [];
    rows.forEach(function (r) {
      if (!byName[r.name]) { byName[r.name] = []; order.push(r.name); }
      byName[r.name].push(r);
    });
    return order.map(function (name) {
      var list = byName[name];
      var total = list.reduce(function (sum, r) { return sum + r.count; }, 0);
      var max = list.reduce(function (m, r) { return Math.max(m, r.count); }, 1);
      var hasValues = list.some(function (r) { return r.value !== null && r.value !== ''; });
      var head = '<div class="evt-h">' + esc(name) + ' <span class="muted">' + total + '</span></div>';
      if (!hasValues) return '<div class="evt">' + head + '</div>';
      var body = list.map(function (r) {
        var label = (r.value === null || r.value === '') ? '(no value)' : r.value;
        var w = ((r.count / max) * 100).toFixed(1);
        return '<div class="row"><span class="bar" style="width:' + w + '%"></span>' +
          '<span class="k" title="' + esc(label) + '">' + esc(label) + '</span>' +
          '<span class="c">' + r.count + '</span></div>';
      }).join('');
      return '<div class="evt">' + head + body + '</div>';
    }).join('');
  }
  function current() {
    var id = $('domain').value;
    return domains.filter(function (d) { return d.id === id; })[0];
  }
  async function loadStats() {
    var dom = current();
    if (!dom) return;
    var days = parseInt($('range').value, 10);
    var to = new Date().toISOString();
    var from = new Date(Date.now() - days * 86400000).toISOString();
    var s = await api('/api/stats?domain=' + encodeURIComponent(dom.id) + '&from=' + from + '&to=' + to);
    $('stats').hidden = false;
    $('uv').textContent = s.visitors.toLocaleString();
    $('pv').textContent = s.pageviews.toLocaleString();
    $('embed').textContent = '<scr' + 'ipt src="' + dom.collectorPath + '" defer></scr' + 'ipt>';
    var maxd = s.byDay.reduce(function (m, d) { return Math.max(m, d.pageviews); }, 1);
    $('byday').innerHTML = s.byDay.length
      ? s.byDay.map(function (d) {
          var h = ((d.pageviews / maxd) * 100).toFixed(1);
          return '<div class="col" title="' + d.day + ': ' + d.pageviews + ' views, ' + d.visitors + ' visitors">' +
            '<div class="fill" style="height:' + h + '%"></div></div>';
        }).join('')
      : '<div class="muted">No data yet</div>';
    $('pages').innerHTML = bars(s.topPages);
    $('refs').innerHTML = bars(s.topReferrers);
    $('countries').innerHTML = bars(s.countries);
    $('devices').innerHTML = bars(s.devices);
    $('browsers').innerHTML = bars(s.browsers);
    $('events').innerHTML = eventsHtml(s.customEvents);
  }
  async function loadDomains() {
    var d = await api('/api/domains');
    domains = d.domains;
    $('domain').innerHTML = domains.map(function (x) {
      return '<option value="' + x.id + '">' + esc(x.hostname) + '</option>';
    }).join('');
    if (!domains.length) { $('empty').hidden = false; $('stats').hidden = true; return; }
    $('empty').hidden = true;
    await loadStats();
  }
  $('domain').onchange = loadStats;
  $('range').onchange = loadStats;
  $('del').onclick = async function () {
    var dom = current();
    if (!dom || !confirm('Delete ' + dom.hostname + ' and all its data?')) return;
    await api('/api/domains/' + dom.id, { method: 'DELETE' });
    await loadDomains();
  };
  loadDomains().catch(function (e) {
    document.body.innerHTML = '<p style="padding:2rem">Failed to load: ' + esc(e.message) + '</p>';
  });
</script>
</body>
</html>`;
}
