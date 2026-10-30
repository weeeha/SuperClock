// Smoke check for the neon face drafts, no browser needed:
//   node docs/drafts/neon-faces/check.mjs [id ...]
// Loads neon.js and each face into a VM with a recording fake canvas, runs
// 45 frames at five times of day, and fails on a throw, a non-finite
// coordinate, an unbalanced save/restore, a banned API, or a face that
// reads the clock itself instead of T.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ALL = [...readFileSync(join(here, 'gallery.js'), 'utf8').match(/const IDS = \[([\s\S]*?)\];/)[1].matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const BANNED_SOURCE = [
  [/\bDate\b/, 'reads Date (use T)'],
  [/performance\.now/, 'reads performance.now (use T.t)'],
  [/\b(setTimeout|setInterval|requestAnimationFrame)\b/, 'runs its own timer'],
  [/shadowBlur/, 'uses shadowBlur (use N.glow)'],
  [/\.filter\s*=/, 'uses ctx.filter'],
  [/getImageData|putImageData/, 'reads or writes pixels'],
  [/\b(document|window)\./, 'touches the DOM'],
  [/Math\.random/, 'uses Math.random (use N.hash for stable randomness)'],
];

function fakeCtx(stats) {
  const store = {
    lineWidth: 1, globalAlpha: 1, font: '10px sans-serif', globalCompositeOperation: 'source-over',
    strokeStyle: '#000', fillStyle: '#000', lineCap: 'butt', lineJoin: 'miter', textAlign: 'start',
    textBaseline: 'alphabetic', shadowColor: 'transparent', shadowBlur: 0, filter: 'none', lineDashOffset: 0,
  };
  const grad = { addColorStop() {} };
  const fontPx = () => parseFloat((/(\d+(?:\.\d+)?)px/.exec(store.font) || [0, 10])[1]);
  const special = {
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    createConicGradient: () => grad,
    createPattern: () => ({}),
    measureText: (s) => ({ width: String(s).length * fontPx() * 0.6, actualBoundingBoxAscent: fontPx() * 0.7, actualBoundingBoxDescent: fontPx() * 0.2 }),
    getImageData: () => { stats.banned.add('getImageData'); return { data: new Uint8ClampedArray(4) }; },
    putImageData: () => stats.banned.add('putImageData'),
    isPointInPath: () => false,
    getLineDash: () => [],
    save: () => { stats.depth++; },
    restore: () => { stats.depth--; },
  };
  const numeric = new Set(['moveTo', 'lineTo', 'arc', 'arcTo', 'quadraticCurveTo', 'bezierCurveTo', 'rect', 'fillRect', 'strokeRect', 'ellipse', 'fillText', 'strokeText', 'translate', 'rotate', 'scale', 'roundRect', 'setTransform', 'transform']);
  return new Proxy({}, {
    get(_, k) {
      if (k in special) { const f = special[k]; return (...a) => { stats.ops++; return f(...a); }; }
      if (k in store) return store[k];
      return (...a) => {
        stats.ops++;
        if (numeric.has(k)) for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) stats.nan.add(k);
      };
    },
    set(_, k, v) {
      if (k === 'shadowBlur' && v) stats.banned.add('shadowBlur');
      if (k === 'filter' && v && v !== 'none') stats.banned.add('filter');
      if ((k === 'lineWidth' || k === 'globalAlpha') && !Number.isFinite(v)) stats.nan.add(k);
      store[k] = v;
      return true;
    },
  });
}

const neonSrc = readFileSync(join(here, 'neon.js'), 'utf8');
const TIMES = ['00:00:00', '10:09:30', '12:59:59', '23:58:45', '06:30:15'];
let failed = 0;

for (const id of ids) {
  const file = join(here, 'faces', `${id}.js`);
  if (!existsSync(file)) { console.log(`${id.padEnd(14)} MISSING faces/${id}.js`); failed++; continue; }
  const src = readFileSync(file, 'utf8');
  const problems = [];
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const [re, why] of BANNED_SOURCE) if (re.test(codeOnly)) problems.push(why);

  const sandbox = { console, Math, JSON, Number, String, Array, Object, Map, Set, Float32Array, Uint8Array, Uint8ClampedArray, Date };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  try {
    vm.runInContext(neonSrc, sandbox, { filename: 'neon.js' });
    vm.runInContext(src, sandbox, { filename: `faces/${id}.js` });
  } catch (e) {
    console.log(`${id.padEnd(14)} FAIL load: ${e.message}`);
    failed++;
    continue;
  }
  const N = sandbox.NEON;
  const face = N.faces.get(id);
  if (!face) { console.log(`${id.padEnd(14)} FAIL: file did not register NEON.face({ id: '${id}' })`); failed++; continue; }
  for (const k of ['name', 'hue', 'idea']) if (!face[k]) problems.push(`missing ${k}`);
  if (face.hue && !N.c[face.hue]) problems.push(`hue '${face.hue}' is not in N.c`);
  if (face.accent && !N.c[face.accent]) problems.push(`accent '${face.accent}' is not in N.c`);

  const stats = { ops: 0, depth: 0, nan: new Set(), banned: new Set() };
  const ctx = fakeCtx(stats);
  const state = {};
  const perFrame = [];
  let ambient = 0;
  try {
    for (const hhmmss of TIMES) {
      const [H, M, S] = hhmmss.split(':').map(Number);
      const base = new Date(2026, 9, 30, H, M, S, 0).getTime();
      for (let f = 0; f < 45; f++) {
        ambient += 1 / 30;
        const T = N.timeState(base + f * 33.3, ambient);
        const before = stats.ops;
        face.draw(ctx, T, N, state);
        perFrame.push(stats.ops - before);
        if (stats.depth !== 0) { problems.push(`save/restore unbalanced (${stats.depth}) at ${hhmmss}`); stats.depth = 0; }
      }
    }
  } catch (e) {
    problems.push(`draw threw: ${e.message}`);
  }
  if (stats.nan.size) problems.push(`non-finite values passed to ${[...stats.nan].join(', ')}`);
  if (stats.banned.size) problems.push(`banned: ${[...stats.banned].join(', ')}`);
  const avg = perFrame.length ? Math.round(perFrame.reduce((a, b) => a + b, 0) / perFrame.length) : 0;
  const max = perFrame.length ? Math.max(...perFrame) : 0;
  if (avg > 6000) problems.push(`heavy: ${avg} canvas calls per frame on average (budget about 6000)`);
  const uniq = [...new Set(problems)];
  if (uniq.length) { failed++; console.log(`${id.padEnd(14)} FAIL ${uniq.join('; ')}`); }
  else console.log(`${id.padEnd(14)} ok   ${String(avg).padStart(5)} calls/frame avg, ${max} max`);
}
process.exit(failed ? 1 : 0);
