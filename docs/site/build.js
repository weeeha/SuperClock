import fs from 'node:fs';
import path from 'node:path';
import APPS from './data.js';

const __dirname = import.meta.dirname;

// Sources live beside this script and are committed. Everything under dist/
// is generated and gitignored — deploy that folder, don't edit it.
const ROOT = path.join(__dirname, 'dist');
const SHOTS = path.join(__dirname, 'shots');
const SRC = path.join(__dirname, 'index.src.html');

// ---------- shared CSS additions (appended to the extracted stylesheet)

const EXTRA_CSS = `
  /* ---------- top-level navigation ---------- */
  .topnav { position: sticky; top: 0; z-index: 50; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
  .topnav-inner { max-width: 1180px; margin: 0 auto; padding: 0 24px; height: 54px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .brand { font-family: var(--font-display); font-size: 14px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); text-decoration: none; }
  .brand span { color: var(--accent); }
  .topnav nav { display: flex; gap: 4px; }
  .topnav nav a { font-family: var(--font-display); font-size: 13px; font-weight: 600; color: var(--ink-2); text-decoration: none; padding: 7px 14px; border-radius: 4px; }
  .topnav nav a:hover { color: var(--ink); background: var(--surface); }
  .topnav nav a[aria-current="page"] { color: var(--accent); background: var(--accent-soft); }
  .topnav nav a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* The sticky header eats the top of the viewport — anchors and the docs
     rail both have to clear it or they sit underneath. */
  section { scroll-margin-top: 74px; }
  @media (min-width: 1040px) { .toc { top: 78px; max-height: calc(100vh - 110px); } }
  .masthead { padding-top: 52px; }

  /* ---------- app catalogue ---------- */
  .catgroup { font-family: var(--font-display); font-size: 10.5px; font-weight: 600; letter-spacing: 0.13em; text-transform: uppercase; color: var(--accent); margin: 44px 0 16px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
  .catgroup:first-of-type { margin-top: 8px; }
  .appcard { display: flex; gap: 18px; align-items: flex-start; background: var(--surface); border: 1px solid var(--line); border-radius: 5px; padding: 18px 20px; text-decoration: none; color: inherit; transition: border-color 0.15s, transform 0.15s; }
  .appcard:hover { border-color: var(--accent); transform: translateY(-2px); }
  .appcard:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  .appcard img { width: 96px; height: 96px; flex-shrink: 0; border-radius: 50%; background: #000; box-shadow: 0 0 0 1px var(--line); }
  .appcard-body { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
  .appcard-top { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .appcard-top h3 { font-family: var(--font-display); font-size: 1.02rem; font-weight: 600; margin: 0; }
  .appcard-top .mono { background: none; padding: 0; font-size: 11.5px; color: var(--ink-3); }
  .appcard p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink-2); }
  .appcard .card-more { font-family: var(--font-display); font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-top: 2px; }

  /* ---------- thumbnail strip on the docs page ---------- */
  .thumbstrip { display: flex; flex-wrap: wrap; gap: 16px; margin: 0 0 26px; }
  .thumbstrip a { display: flex; flex-direction: column; align-items: center; gap: 7px; width: 84px; text-decoration: none; }
  .thumbstrip img { width: 68px; height: 68px; border-radius: 50%; background: #000; box-shadow: 0 0 0 1px var(--line); transition: box-shadow 0.15s; }
  .thumbstrip a:hover img { box-shadow: 0 0 0 2px var(--accent); }
  .thumbstrip span { font-family: var(--font-display); font-size: 11px; color: var(--ink-2); text-align: center; line-height: 1.3; }
  .thumbstrip a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
  .bigcta { display: inline-block; font-family: var(--font-display); font-size: 13px; font-weight: 600; color: var(--accent); text-decoration: none; border: 1px solid var(--accent); border-radius: 4px; padding: 9px 16px; }
  .bigcta:hover { background: var(--accent-soft); }

  /* ---------- app detail pages ---------- */
  .crumb { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: 12px; margin: 0 0 22px; flex-wrap: wrap; }
  .crumb a { color: var(--accent); text-decoration: none; }
  .crumb a:hover { text-decoration: underline; }
  .crumb span { color: var(--ink-3); }
  .app-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin: 0 0 10px; }
  .app-head h1 { margin: 0; font-size: clamp(1.9rem, 3.6vw, 2.5rem); }
  .shotwrap { background: var(--surface); border: 1px solid var(--line); border-radius: 5px; padding: 18px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  /* height:auto is load-bearing — without it the width/height attributes win
     over aspect-ratio and the circular crop renders as an egg. */
  .shotwrap img { width: min(420px, 100%); height: auto; aspect-ratio: 1 / 1; border-radius: 50%; display: block; background: #000; box-shadow: 0 0 0 1px var(--line); }
  .shotwrap p { font-family: var(--font-display); font-size: 12.5px; line-height: 1.5; color: var(--ink-3); text-align: center; max-width: 56ch; margin: 0; }
  /* Generated diagrams are drawn at a fixed natural size, set inline in px.
     They must never scale: stretching to fill blew a small sitemap up to 1.8x,
     and shrinking to fit rendered flow labels at ~5px on a phone. Oversized
     diagrams overflow and .scroller pans them instead. */
  .scroller svg.dgm { min-width: 0; height: auto; }
  .kv { width: 100%; border-collapse: collapse; }
  .kv td { padding: 11px 0; border-bottom: 1px solid var(--line-2); font-size: 14px; vertical-align: top; }
  .kv tr:last-child td { border-bottom: 0; }
  .kv td:first-child { width: 108px; font-family: var(--font-display); font-size: 10.5px; font-weight: 600; letter-spacing: 0.11em; text-transform: uppercase; color: var(--ink-3); padding-top: 14px; }
  .filelist { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 0; list-style: none; }
  .filelist li { font-family: var(--font-mono); font-size: 12px; color: var(--ink-2); background: var(--surface); border: 1px solid var(--line); border-radius: 3px; padding: 5px 9px; }
  .pager { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid var(--line); padding-top: 22px; margin-top: 8px; }
  .pager a { font-family: var(--font-display); font-size: 13px; color: var(--accent); text-decoration: none; max-width: 46%; }
  .pager a:hover { text-decoration: underline; }
  .pager .none { color: var(--ink-3); opacity: 0.45; }
  .flowtitle { font-family: var(--font-display); font-size: 10.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); margin: 26px 0 10px; }
`;

// ---------- helpers

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TONE_CLASS = { ok: 'ok', warn: 'warn', risk: 'risk', info: 'info' };
const SEV_CLASS = { risk: 'sev-1', warn: 'sev-2', info: 'sev-3' };

function nav(active) {
  const item = (href, label, key) =>
    `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="topnav"><div class="topnav-inner">` +
    `<a class="brand" href="/docs">Super<span>Clock</span></a>` +
    `<nav>${item('/docs', 'Docs', 'docs')}${item('/apps', 'Apps', 'apps')}</nav>` +
    `</div></header>`;
}

function wrap(title, desc, body, extraHead = '') {
  const icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%95%90%3C/text%3E%3C/svg%3E";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="color-scheme" content="light dark">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<link rel="icon" href="${icon}">
<link rel="stylesheet" href="/style.css">
${extraHead}</head>
<body>
${body}
</body>
</html>
`;
}

// ---------- diagram generators

function marker(id) {
  return `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>`;
}

function node(x, y, w, h, label, sub, key) {
  let out = `<rect class="${key ? 'box-key' : 'box'}" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`;
  out += `<text class="t" x="${x + 14}" y="${y + (sub ? 24 : 31)}">${esc(label)}</text>`;
  if (sub) out += `<text class="s" x="${x + 14}" y="${y + 41}">${esc(sub)}</text>`;
  return out;
}

function sitemapSvg(tree, uid) {
  const W = 200, H = 54, VG = 9, COL = 268;
  const kids = tree.children || [];
  const stackH = kids.length * (H + VG) - VG;
  const height = Math.max(stackH, H) + 16;
  const rootY = (height - H) / 2;
  const width = COL + W + 4;

  let s = `<svg class="dgm" style="width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sitemap for ${esc(tree.label)}">`;
  s += marker(uid) + `<g color="var(--ink-3)">`;
  s += node(4, rootY, W, H, tree.label, tree.sub, true);
  kids.forEach((k, i) => {
    const y = (height - stackH) / 2 + i * (H + VG);
    s += node(COL, y, W, H, k.label, k.sub, false);
    s += `<path class="edge" d="M ${4 + W} ${rootY + H / 2} H ${4 + W + 32} V ${y + H / 2} H ${COL - 8}" marker-end="url(#${uid})"/>`;
  });
  return s + `</g></svg>`;
}

function flowSvg(steps, uid) {
  const W = 172, H = 58, HG = 38, PER = 5;
  const rows = [];
  for (let i = 0; i < steps.length; i += PER) rows.push(steps.slice(i, i + PER));
  const width = Math.min(steps.length, PER) * (W + HG) - HG + 8;
  const height = rows.length * (H + 44) - 44 + 8;

  let s = `<svg class="dgm" style="width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="Flow diagram">`;
  s += marker(uid) + `<g color="var(--ink-3)">`;
  rows.forEach((row, ri) => {
    const y = ri * (H + 44) + 4;
    row.forEach((st, i) => {
      const x = i * (W + HG) + 4;
      s += node(x, y, W, H, st.label, st.sub, false);
      if (i < row.length - 1) s += `<path class="edge" d="M ${x + W} ${y + H / 2} H ${x + W + HG - 8}" marker-end="url(#${uid})"/>`;
    });
    if (ri < rows.length - 1) {
      const lastX = (row.length - 1) * (W + HG) + 4 + W / 2;
      s += `<path class="edge" d="M ${lastX} ${y + H} V ${y + H + 22} H ${4 + W / 2} V ${y + H + 40}" marker-end="url(#${uid})"/>`;
    }
  });
  return s + `</g></svg>`;
}

// ---------- pages

const CATEGORIES = [
  { key: 'utility', label: 'Utility', blurb: 'Time, weather, dates, and the radar — the things you glance at.' },
  { key: 'productivity', label: 'Productivity', blurb: 'Apps that track something over time and want a weekly summary.' },
  { key: 'ambient', label: 'Ambient', blurb: 'Screens meant to be looked at rather than read.' },
];

function appsIndexPage() {
  let h = nav('apps');
  h += `<div class="page"><main style="grid-column: 1 / -1; max-width: 900px; margin: 0 auto;">`;
  h += `<header class="masthead" style="border-bottom:none; margin-bottom:8px; padding-bottom:16px">`;
  h += `<p class="eyebrow">App catalogue</p>`;
  h += `<h1>Twelve apps, grouped the way the code groups them</h1>`;
  h += `<p class="standfirst">Every app is a self-registering module under <code>src/apps/</code>. Each card opens a documentation page with a real screenshot, its sitemap, key flows, and what is still outstanding. Screenshots are genuine captures — including the offline states.</p>`;
  h += `</header>`;

  CATEGORIES.forEach((cat) => {
    const inCat = APPS.filter((a) => a.category === cat.key);
    if (!inCat.length) return;
    h += `<p class="catgroup">${esc(cat.label)} · ${inCat.length}</p>`;
    h += `<p class="lede" style="margin-bottom:18px">${esc(cat.blurb)}</p>`;
    h += `<div class="grid" style="grid-template-columns:1fr">`;
    inCat.forEach((a) => {
      h += `<a class="appcard" href="/apps/${a.id}">`;
      h += `<img src="/shots/${a.shot}" alt="" loading="lazy" width="1080" height="1080">`;
      h += `<div class="appcard-body">`;
      h += `<div class="appcard-top"><h3>${esc(a.name)}</h3><span class="mono">${esc(a.id)}</span><span class="pill ${TONE_CLASS[a.status.tone]}">${esc(a.status.label)}</span></div>`;
      h += `<p>${a.tagline}</p>`;
      h += `<div class="card-more">Open documentation →</div>`;
      h += `</div></a>`;
    });
    h += `</div>`;
  });

  h += `</main></div>`;
  return wrap('Apps — SuperClock', 'The twelve SuperClock kiosk apps, each with a screenshot, sitemap, key flows, and outstanding work.', h);
}

function appPage(app, prev, next) {
  let h = nav('apps');
  h += `<div class="page"><main style="grid-column: 1 / -1; max-width: 900px; margin: 0 auto; padding-top: 44px;">`;
  h += `<p class="crumb"><a href="/docs">Docs</a><span>/</span><a href="/apps">Apps</a><span>/</span><span>${esc(app.name)}</span></p>`;
  h += `<div class="app-head"><h1>${esc(app.name)}</h1><span class="pill ${TONE_CLASS[app.status.tone]}">${esc(app.status.label)}</span></div>`;
  h += `<p class="standfirst" style="margin-bottom:14px">${app.tagline}</p>`;
  h += `<ul class="filelist" style="margin-bottom:40px"><li>${esc(app.id)}</li><li>${esc(app.category)}</li></ul>`;

  h += `<section><div class="shotwrap"><img src="/shots/${app.shot}" alt="${esc(app.name)} rendered on the round display" loading="lazy" width="1080" height="1080"><p>${app.shotNote}</p></div></section>`;

  h += `<section><h2>What it is</h2>`;
  app.description.forEach((p) => { h += `<p>${p}</p>`; });
  h += `<table class="kv">`;
  app.data.forEach(([k, v]) => { h += `<tr><td>${esc(k)}</td><td>${v}</td></tr>`; });
  h += `</table></section>`;

  h += `<section><h2>App sitemap</h2><p class="lede">Every view this app can present, as the code actually defines them.</p>`;
  h += `<div class="figure"><div class="scroller">${sitemapSvg(app.sitemap, `sm-${app.id}`)}</div></div></section>`;

  h += `<section><h2>Key flows</h2>`;
  app.flows.forEach((f, i) => {
    h += `<p class="flowtitle">${esc(f.title)}</p>`;
    h += `<div class="figure"><div class="scroller">${flowSvg(f.steps, `fl-${app.id}-${i}`)}</div></div>`;
  });
  h += `</section>`;

  h += `<section><h2>Tasks remaining</h2>`;
  app.tasks.forEach((t, i) => {
    h += `<div class="gap ${SEV_CLASS[t.tone]}"><div class="gap-head"><span class="gap-num">${String(i + 1).padStart(2, '0')}</span>`;
    h += `<h4>${t.t}</h4><span class="pill ${TONE_CLASS[t.tone]}">${t.tone === 'risk' ? 'Blocking' : t.tone === 'warn' ? 'Needs work' : 'Nice to have'}</span></div>`;
    h += `<p>${t.d}</p></div>`;
  });
  h += `</section>`;

  h += `<section><h2>Where it lives</h2><ul class="filelist">`;
  app.files.forEach((f) => { h += `<li>${esc(f)}</li>`; });
  h += `</ul></section>`;

  h += `<div class="pager">`;
  h += prev ? `<a href="/apps/${prev.id}">← ${esc(prev.name)}</a>` : `<span class="pager none">—</span>`;
  h += next ? `<a href="/apps/${next.id}" style="text-align:right">${esc(next.name)} →</a>` : `<span class="pager none">—</span>`;
  h += `</div></main></div>`;

  return wrap(`${app.name} — SuperClock`, app.tagline, h);
}

// ---------- build

// Start from a clean output tree, then stage the committed screenshots into it.
fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
for (const f of fs.readdirSync(SHOTS)) {
  if (f.endsWith('.png')) fs.copyFileSync(path.join(SHOTS, f), path.join(ROOT, 'shots', f));
}

let src = fs.readFileSync(SRC, 'utf8');

// 1. Extract the inline stylesheet into a shared file.
const styleMatch = src.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error('no <style> block found in the source page');
fs.writeFileSync(path.join(ROOT, 'style.css'), styleMatch[1] + EXTRA_CSS);

// 2. Docs page = the original survey, minus the app card grid, plus the nav.
let docs = src
  .replace(styleMatch[0], '')
  .replace(/^[\s\S]*?<body>\n?/, '')
  .replace(/<\/body>[\s\S]*$/, '')
  .replace(/<title>[\s\S]*?<\/title>/, '');

// The full card grid moves to /apps; the docs page keeps a pointer to it.
const appsSection = src.match(/<section id="apps">[\s\S]*?<\/section>/);
if (!appsSection) throw new Error('could not find the apps section to replace');

let pointer = `<section id="apps">`;
pointer += `<h2>The twelve apps</h2>`;
pointer += `<p class="lede">Each app is a module under <code>src/apps/</code> that registers itself and lazy-loads. Adding one means touching three lists — the side-import, the capability array, and the schema registry — and a coherence test fails until they agree.</p>`;
pointer += `<p class="lede">Full documentation for each app — a real screenshot, its sitemap, key flows, and outstanding work — lives in the <a href="/apps">Apps</a> section.</p>`;
pointer += `<div class="thumbstrip">`;
APPS.forEach((a) => {
  pointer += `<a href="/apps/${a.id}" title="${esc(a.name)}"><img src="/shots/${a.shot}" alt="" loading="lazy" width="1080" height="1080"><span>${esc(a.name)}</span></a>`;
});
pointer += `</div>`;
pointer += `<p><a class="bigcta" href="/apps">Browse all twelve apps →</a></p>`;
pointer += `</section>`;

docs = docs.replace(appsSection[0], pointer);
docs = nav('docs') + docs;

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'docs', 'index.html'),
  wrap('SuperClock — System Map', 'Concept map, sitemap, API surface and ranked gap evaluation for the SuperClock Raspberry Pi clock fleet.', docs),
);

// 3. Apps catalogue + detail pages.
fs.mkdirSync(path.join(ROOT, 'apps'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'apps', 'index.html'), appsIndexPage());
APPS.forEach((app, i) => {
  fs.writeFileSync(
    path.join(ROOT, 'apps', `${app.id}.html`),
    appPage(app, APPS[i - 1] || null, APPS[i + 1] || null),
  );
});

// 4. Root redirects into the docs section — there is no flat index page.
fs.writeFileSync(
  path.join(ROOT, 'vercel.json'),
  JSON.stringify(
    {
      cleanUrls: true,
      trailingSlash: false,
      redirects: [{ source: '/', destination: '/docs', permanent: false }],
    },
    null,
    2,
  ),
);

console.log(`docs page + apps catalogue + ${APPS.length} app pages -> ${path.relative(process.cwd(), ROOT)}`);
const missing = APPS.filter((a) => !fs.existsSync(path.join(SHOTS, a.shot)));
console.log('missing screenshots:', missing.length ? missing.map((a) => a.shot).join(', ') : 'none');
