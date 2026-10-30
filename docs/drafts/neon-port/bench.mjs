// Drive the neon port bench in headless Chrome (dev server on :5180):
//   node docs/drafts/neon-port/bench.mjs time neon-sign neon-tube
//       prints ms per frame at 1080 for each face (lower is better)
//   node docs/drafts/neon-port/bench.mjs shot neon-sign [--t 10:09:30,23:58:45]
//       writes docs/drafts/neon-port/shots/<id>-<HHMMSS>.png (git-ignored)
// NEON_CDP=http://127.0.0.1:9333 drives an already-running Chromium instead
// of launching one (for timing on a Pi through an ssh tunnel); NEON_URL is
// then the dev server as that machine reaches it.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [mode, ...rest] = process.argv.slice(2);
const tIdx = rest.indexOf('--t');
const times = tIdx >= 0 ? rest[tIdx + 1].split(',') : ['10:09:30'];
const ids = rest.filter((a, i) => !a.startsWith('--') && (tIdx < 0 || i !== tIdx + 1));
if (!['time', 'shot'].includes(mode) || !ids.length) {
  console.error('usage: node docs/drafts/neon-port/bench.mjs time|shot <face-id> [...] [--t HH:MM:SS,...]');
  process.exit(1);
}
const origin = process.env.NEON_URL || 'http://localhost:5180';
const chrome = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium'].find(existsSync);
const remote = process.env.NEON_CDP;
let proc = null;
let profile = null;
let port;
if (remote) {
  port = new URL(remote).port;
} else {
  profile = mkdtempSync(join(tmpdir(), 'neon-port-'));
  proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1000,1000', '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
    proc.on('exit', (c) => reject(new Error(`chrome exited ${c}`)));
    setTimeout(() => reject(new Error('chrome did not start')), 15000);
  });
  port = new URL(wsUrl).port;
}
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
};
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (expr, ms) => { for (let i = 0; i < ms / 100; i++) { const v = await evaluate(expr).catch(() => null); if (v) return v; await sleep(100); } return null; };

let bad = 0;
try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 1000, deviceScaleFactor: 1, mobile: false });
  if (mode === 'time') {
    const search = `bench=${ids.join(',')}&t=${times[0]}`;
    await send('Page.navigate', { url: `${origin}/docs/drafts/neon-port/index.html?${search}` });
    const res = await waitFor(`location.search.includes(${JSON.stringify(search)}) && (window.__bench || window.__error)`, 60000);
    const gpu = await evaluate(`(() => { const g = document.createElement('canvas').getContext('webgl'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'no webgl'; })()`).catch(() => '?');
    console.log(`renderer: ${gpu}`);
    if (!res || typeof res === 'string') { bad = 1; console.log(`bench failed: ${res || 'timeout'}`); }
    else for (const [id, ms] of Object.entries(res)) console.log(`${id.padEnd(14)} ${String(ms).padStart(6)} ms/frame at 1080`);
  } else {
    mkdirSync(join(here, 'shots'), { recursive: true });
    for (const id of ids) for (const t of times) {
      const search = `face=${id}&t=${t}`;
      await send('Page.navigate', { url: `${origin}/docs/drafts/neon-port/index.html?${search}` });
      const ok = await waitFor(`location.search.includes(${JSON.stringify(search)}) && (window.__ready || window.__error)`, 20000);
      await sleep(1200);
      const err = await evaluate('window.__error || ""');
      const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1000, height: 1000, scale: 1 } });
      const file = join(here, 'shots', `${id}-${t.replace(/:/g, '')}.png`);
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
      if (!ok || err) bad++;
      console.log(`${file}${err ? '  ERROR: ' + err.split('\n')[0] : ''}`);
    }
  }
} finally {
  ws.close();
  if (proc) {
    const exited = new Promise((r) => proc.once('exit', r));
    proc.kill('SIGKILL');
    await exited;
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* temp dir */ }
  }
}
process.exit(bad ? 1 : 0);
