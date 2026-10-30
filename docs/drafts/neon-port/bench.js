// Port bench for the neon faces, through the kiosk's own render path
// (renderFrame in src/apps/clock/neon/neon.ts):
//   ?face=neon-sign&t=10:09:30    draws that face live, clock frozen at t
//   ?bench=neon-sign,neon-tube    times 90 frames of each at 1080 and writes
//                                 JSON to #result and window.__bench
import { createKit, neonTime, renderFrame } from '/src/apps/clock/neon/neon.ts';

const q = new URLSearchParams(location.search);
const frozen = q.get('t');
const at = () => {
  if (!frozen) return new Date();
  const [H, M, S] = frozen.split(':').map(Number);
  const d = new Date();
  d.setHours(H || 0, M || 0, S || 0, 0);
  return d;
};
const load = async (id) => (await import(`/src/apps/clock/neon/faces/${id.replace(/^neon-/, '')}.ts`)).default;

async function live(id) {
  const face = await load(id);
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const kit = createKit(q.get('glow') === 'soft' ? 0.35 : 1);
  const state = {};
  const t0 = performance.now();
  const px = Math.round(canvas.clientWidth * (face.resolution ?? 1));
  canvas.width = px;
  canvas.height = px;
  const loop = (now) => {
    try {
      renderFrame(ctx, face, kit, state, neonTime(at(), (now - t0) / 1000));
      window.__ready = true;
    } catch (e) {
      window.__error = String(e && e.stack || e);
      document.getElementById('result').textContent = window.__error;
      return;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function bench(ids) {
  const out = {};
  for (const id of ids) {
    const face = await load(id);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.round(1080 * (face.resolution ?? 1));
    const ctx = canvas.getContext('2d');
    const kit = createKit(1);
    const state = {};
    const base = at().getTime();
    let t = 0;
    for (let i = 0; i < 15; i++) {
      t += 1 / 30;
      renderFrame(ctx, face, kit, state, neonTime(new Date(base + i * 33), t));
    }
    ctx.getImageData(0, 0, 1, 1);
    const start = performance.now();
    for (let i = 0; i < 90; i++) {
      t += 1 / 30;
      renderFrame(ctx, face, kit, state, neonTime(new Date(base + (15 + i) * 33), t));
      if (i % 10 === 9) ctx.getImageData(0, 0, 1, 1); // flush queued raster into the timing
    }
    out[id] = +((performance.now() - start) / 90).toFixed(2);
  }
  window.__bench = out;
  document.getElementById('result').textContent = JSON.stringify(out, null, 1);
}

const ids = q.get('bench');
if (ids) bench(ids.split(',')).catch((e) => { window.__error = String(e); });
else live(q.get('face') || 'neon-tube').catch((e) => { window.__error = String(e); });
