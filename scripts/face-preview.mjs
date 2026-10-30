// Capture a face's admin preview: npm run preview:face -- <face-id> [--time HH:MM:SS]
//
// Drives headless Chrome over the DevTools protocol (no npm dependency: Node's
// own WebSocket and fetch) against the running dev server, freezes Date at the
// given time of today so the hands sit still, cycles the Clock app to the
// face through window.__nav, and writes a true 1000x1000 PNG of the real
// component to public/<id>-preview.png, the path face-registry.ts points at.
//
// The dev server must be up (npm run dev, port 5180); FACE_PREVIEW_URL
// overrides the origin. CHROME_PATH overrides the browser binary. WebGL faces
// render through SwiftShader here, so a preview is the face's composition,
// not its on-glass frame rate.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url'; // never URL.pathname: this checkout path contains spaces
import { argv, env, exit, chdir } from 'node:process';

chdir(fileURLToPath(new URL('..', import.meta.url)));

const args = argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const timeArg = args[args.indexOf('--time') + 1];
const time = args.includes('--time') && timeArg ? timeArg : '10:09:30';
if (!id) {
  console.error('usage: npm run preview:face -- <face-id> [--time HH:MM:SS]');
  exit(1);
}

// The Clock app cycles faces in SWIPE_CYCLE_ORDER; the face id maps to a
// component through FACE_COMPONENTS. Read both from the source so this script
// never carries its own copy of the order.
const faceComponents = readFileSync('src/apps/clock/face-components.ts', 'utf8');
const mapBody = faceComponents.match(/FACE_COMPONENTS[^{]*\{([\s\S]*?)\n\};/)?.[1] ?? '';
const componentOf = {};
for (const m of mapBody.matchAll(/^\s*'?([\w-]+)'?:\s*(\w+),/gm)) componentOf[m[1]] = m[2];
const orderBody = faceComponents.match(/SWIPE_CYCLE_ORDER[^[]*\[([\s\S]*?)\n\];/)?.[1] ?? '';
const order = [...orderBody.matchAll(/^\s*(\w+),/gm)].map((m) => m[1]);
const component = componentOf[id];
const index = component ? order.indexOf(component) : -1;
if (index < 0) {
  console.error(`face-preview: '${id}' is not in FACE_COMPONENTS / SWIPE_CYCLE_ORDER`);
  exit(1);
}

const origin = env.FACE_PREVIEW_URL ?? 'http://localhost:5180';
const chrome =
  env.CHROME_PATH ??
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
if (!chrome) {
  console.error('face-preview: no Chrome found; set CHROME_PATH');
  exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'face-preview-'));
const proc = spawn(
  chrome,
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--window-size=1000,1000',
    '--hide-scrollbars',
    '--no-first-run',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
const cleanup = () => {
  proc.kill('SIGKILL');
  rmSync(profile, { recursive: true, force: true });
};

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  proc.stderr.on('data', (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (m) resolve(m[1]);
  });
  proc.on('exit', (code) => reject(new Error(`chrome exited ${code}\n${buf}`)));
  setTimeout(() => reject(new Error('chrome did not print its DevTools endpoint')), 15000);
});
const port = new URL(wsUrl).port;
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let seq = 0;
const pending = new Map();
const events = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
  } else if (msg.method) {
    events.push(msg.method);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++seq;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (expression, label, timeoutMs = 15000) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${label}`);
};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 1000, deviceScaleFactor: 1, mobile: false });
  // Freeze the clock: every `new Date()` and `Date.now()` is the given time of
  // today, so the hands and any time-driven part sit still for the capture.
  const [hh, mm, ss] = time.split(':').map(Number);
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const fixed = new Date(); fixed.setHours(${hh}, ${mm}, ${ss}, 0);
      const t = fixed.getTime();
      const RealDate = Date;
      function FrozenDate(...a) { return a.length ? new RealDate(...a) : new RealDate(t); }
      FrozenDate.prototype = RealDate.prototype;
      FrozenDate.now = () => t;
      FrozenDate.parse = RealDate.parse; FrozenDate.UTC = RealDate.UTC;
      window.Date = FrozenDate;
    })();`,
  });
  await send('Page.navigate', { url: `${origin}/` });
  await waitFor('Boolean(window.__nav)', 'the kiosk nav store');
  await evaluate(`(() => { const s = window.__nav.getState(); s.switchToApp('clock'); window.__nav.getState().finishTransition(); return true; })()`);
  await waitFor('Boolean(window.__nav.getState().verticalSwipeCallback)', 'the Clock app');
  await evaluate(`(() => { const cb = window.__nav.getState().verticalSwipeCallback; for (let i = 0; i < ${index}; i++) cb('down'); return true; })()`);
  // Hide the dev build badge, then give fonts, lazy chunks and any frame a
  // moment to settle.
  await evaluate(`(() => { const st = document.createElement('style'); st.textContent = 'div.fixed.top-1.right-1 { display: none !important; }'; document.head.append(st); return true; })()`);
  await evaluate('document.fonts.ready.then(() => true)');
  await waitFor(`[...document.querySelectorAll('iframe')].every((f) => f.style.opacity !== '0')`, 'embedded frames', 10000).catch(() => {});
  await sleep(2500);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1000, height: 1000, scale: 1 } });
  const out = `public/${id}-preview.png`;
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`face-preview: wrote ${out} (${id} at ${time})`);
} finally {
  ws.close();
  cleanup();
}
