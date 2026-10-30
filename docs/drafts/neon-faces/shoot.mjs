// Screenshot neon face drafts with headless Chrome against the dev server:
//   node docs/drafts/neon-faces/shoot.mjs <id> [id ...] [--t 10:09:30,23:58:45]
// Writes docs/drafts/neon-faces/shots/<id>-<HHMMSS>.png at 1000 x 1000 (open
// them with an image viewer, or the Read tool). The dev server must be up on
// :5180 (NEON_URL overrides the origin); CHROME_PATH overrides the browser.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const tIdx = args.indexOf('--t');
const times = tIdx >= 0 ? args[tIdx + 1].split(',') : ['10:09:30'];
const ids = args.filter((a, i) => !a.startsWith('--') && i !== tIdx + 1);
if (!ids.length) {
  console.error('usage: node docs/drafts/neon-faces/shoot.mjs <id> [id ...] [--t HH:MM:SS,...]');
  process.exit(1);
}
const origin = process.env.NEON_URL || 'http://localhost:5180';
const chrome = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
if (!chrome) { console.error('no Chrome found; set CHROME_PATH'); process.exit(1); }
const outDir = join(here, 'shots');
mkdirSync(outDir, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'neon-shoot-'));
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1000,1000', '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
  proc.on('exit', (code) => reject(new Error(`chrome exited ${code}`)));
  setTimeout(() => reject(new Error('chrome did not start')), 15000);
});
const port = new URL(wsUrl).port;
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let bad = 0;
try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 1000, deviceScaleFactor: 1, mobile: false });
  for (const id of ids) {
    for (const t of times) {
      await send('Page.navigate', { url: `${origin}/docs/drafts/neon-faces/index.html?solo=${encodeURIComponent(id)}&t=${t}` });
      let ready = false;
      // Match the new document's own query: right after navigate, evaluate can
      // still run in the previous page, whose ready flag is already true.
      const want = JSON.stringify(`solo=${encodeURIComponent(id)}&t=${t}`);
      for (let i = 0; i < 100 && !ready; i++) { await sleep(100); ready = await evaluate(`location.search.includes(${want}) && (window.__neonReady === true || (window.__neonErrors || []).length > 0)`).catch(() => false); }
      await sleep(1500);
      const errors = await evaluate('JSON.stringify(window.__neonErrors || [])');
      const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1000, height: 1000, scale: 1 } });
      const file = join(outDir, `${id}-${t.replace(/:/g, '')}.png`);
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
      const errs = JSON.parse(errors || '[]');
      if (errs.length) bad++;
      console.log(`${file}${errs.length ? '  ERRORS: ' + errs.join(' | ') : ''}`);
    }
  }
} finally {
  ws.close();
  const exited = new Promise((r) => proc.once('exit', r));
  proc.kill('SIGKILL');
  await exited;
  // Chrome's helpers can still be flushing into the profile for a moment.
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* temp dir; the OS reaps it */ }
}
process.exit(bad ? 1 : 0);
