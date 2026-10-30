import type { NeonFace, NeonKit } from '../neon';

// Nixie: four glass tubes in a 2 by 2 block, HH over MM. Each tube holds ten
// stacked cathode numerals; only the one with current on it glows orange.
// Ported from docs/drafts/neon-faces/faces/nixie.js. The glass, mesh and
// unlit numerals are one static layer; the four lit numerals are a layer that
// rebuilds when the minute changes, and draw live only while a digit fades.

interface Cell { cur: string; prev: string; t0: number }
interface State { ready?: boolean; d?: Cell[] }

const TW = 220, TH = 306;   // tube envelope
const GX = 32, GY = 34;     // gaps between tubes
const DW = 120, DH = 206;   // numeral box
const FADE = 0.12;          // seconds for the old numeral to die
const IGNITE = 0.25;        // seconds the new numeral stutters

type Seg = readonly (string | number)[];
// Cathode numerals as thin nixie wire in the unit box. 'e' is an ellipse
// [cx, cy, rx, ry]; M/L/C are path ops.
const GLYPH: Seg[][] = [
  [['e', 0.5, 0.5, 0.5, 0.5]],
  [['M', 0.18, 0.22, 'L', 0.55, 0, 'L', 0.55, 1]],
  [['M', 0.06, 0.26, 'C', 0.06, -0.06, 0.94, -0.06, 0.94, 0.28, 'C', 0.94, 0.55, 0.3, 0.7, 0.04, 1, 'L', 0.96, 1]],
  [['M', 0.08, 0.1, 'C', 0.3, -0.05, 0.92, -0.02, 0.9, 0.25, 'C', 0.88, 0.46, 0.55, 0.48, 0.38, 0.48, 'C', 0.62, 0.48, 0.96, 0.52, 0.94, 0.76, 'C', 0.92, 1.05, 0.3, 1.05, 0.04, 0.88]],
  [['M', 0.72, 1, 'L', 0.72, 0, 'L', 0.02, 0.7, 'L', 1, 0.7]],
  [['M', 0.9, 0, 'L', 0.18, 0, 'L', 0.1, 0.46, 'C', 0.5, 0.34, 0.96, 0.44, 0.96, 0.72, 'C', 0.96, 1.04, 0.3, 1.05, 0.04, 0.86]],
  [['M', 0.88, 0.06, 'C', 0.5, -0.06, 0.06, 0.14, 0.06, 0.66, 'C', 0.06, 1.06, 0.94, 1.06, 0.94, 0.7, 'C', 0.94, 0.34, 0.3, 0.3, 0.09, 0.64]],
  [['M', 0.04, 0, 'L', 0.96, 0, 'L', 0.36, 1]],
  [['e', 0.5, 0.25, 0.38, 0.25], ['e', 0.5, 0.75, 0.46, 0.25]],
  [],
];
// Nine is the six turned upside down: cleaner than hand-drawing a second hook.
GLYPH[9] = GLYPH[6];

function drawGlyph(c: CanvasRenderingContext2D, N: NeonKit, d: number, x: number, y: number, w: number, h: number) {
  const flip = d === 9;
  const X = (u: number) => x + (flip ? 1 - u : u) * w;
  const Y = (v: number) => y + (flip ? 1 - v : v) * h;
  for (const sp of GLYPH[d]) {
    if (sp[0] === 'e') {
      const [, cx, cy, rx, ry] = sp as [string, number, number, number, number];
      c.moveTo(X(cx) + rx * w, Y(cy));
      c.ellipse(X(cx), Y(cy), rx * w, ry * h, 0, 0, N.TAU);
      continue;
    }
    const s = sp as (string | number)[];
    const n = (k: number) => s[k] as number;
    for (let i = 0; i < s.length;) {
      const op = s[i++];
      if (op === 'M') { c.moveTo(X(n(i)), Y(n(i + 1))); i += 2; }
      else if (op === 'L') { c.lineTo(X(n(i)), Y(n(i + 1))); i += 2; }
      else { c.bezierCurveTo(X(n(i)), Y(n(i + 1)), X(n(i + 2)), Y(n(i + 3)), X(n(i + 4)), Y(n(i + 5))); i += 6; }
    }
  }
}

const colX = [500 - (TW + GX / 2), 500 + GX / 2];
const rowY = [500 - (TH + GY / 2), 500 + GY / 2];

const face: NeonFace<State> = {
  id: 'neon-nixie',
  draw(ctx, T, N, state) {
    const ink = N.c.orange;
    const digits = T.hh + T.mm;
    if (!state.d) {
      state.d = [0, 1, 2, 3].map((i) => ({ cur: digits[i], prev: digits[i], t0: -99 }));
      state.ready = true;
    }
    const cells = state.d;

    // Static furniture: glass, mesh, the ten stacked cathodes.
    N.layer(ctx, state, 'glass', 'static', (l) => {
      for (let i = 0; i < 4; i++) {
        const tx = colX[i % 2], ty = rowY[i >> 1];
        const dx = tx + (TW - DW) / 2, dy = ty + 56;
        const cx = tx + TW / 2;
        const env = (c: CanvasRenderingContext2D, inset: number) => {
          const r = TW / 2 - inset;
          c.moveTo(tx + inset, ty + TH - 24);
          c.lineTo(tx + inset, ty + TW / 2);
          c.arc(cx, ty + TW / 2, r, Math.PI, 0);
          c.lineTo(tx + TW - inset, ty + TH - 24);
        };
        l.save();
        l.beginPath();
        env(l, 0);
        l.lineTo(tx, ty + TH - 24);
        l.fillStyle = N.rgba(ink, 0.025);
        l.fill();
        l.lineWidth = 2.4;
        l.strokeStyle = N.rgba(ink, 0.3);
        l.stroke();
        l.beginPath();
        env(l, 7);
        l.lineWidth = 1.2;
        l.strokeStyle = N.rgba(ink, 0.12);
        l.stroke();
        l.beginPath();
        l.moveTo(tx + 20, ty + 90);
        l.lineTo(tx + 20, ty + 190);
        l.lineWidth = 3;
        l.strokeStyle = 'rgba(255,255,255,0.07)';
        l.stroke();
        l.fillStyle = N.rgba(ink, 0.09);
        l.fillRect(tx - 6, ty + TH - 24, TW + 12, 24);
        l.strokeStyle = N.rgba(ink, 0.3);
        l.lineWidth = 2;
        l.strokeRect(tx - 6, ty + TH - 24, TW + 12, 24);
        l.restore();

        // Honeycomb mesh, clipped to the straight part of the glass.
        l.save();
        l.beginPath();
        l.rect(tx + 12, ty + 44, TW - 24, TH - 80);
        l.clip();
        l.beginPath();
        const S = 16, W = S * 1.732, RH = S * 1.5;
        for (let r = 0; r < 11; r++) {
          const y0 = ty + 34 + r * RH;
          for (let k = 0; k < 9; k++) {
            const x = tx + 4 + (k * W) / 2;
            const y = y0 + ((k + r) % 2 === 0 ? S / 2 : 0);
            if (k === 0) l.moveTo(x, y); else l.lineTo(x, y);
            if ((k + r) % 2 === 0 && r < 10) { l.moveTo(x, y); l.lineTo(x, y + S); l.moveTo(x, y); }
          }
        }
        l.lineWidth = 1.1;
        l.strokeStyle = N.rgba(ink, 0.075);
        l.stroke();
        l.restore();

        // All ten cathodes stacked behind, barely there.
        l.save();
        l.beginPath();
        for (let d = 0; d < 10; d++) drawGlyph(l, N, d, dx, dy, DW, DH);
        l.lineWidth = 2.4;
        l.lineJoin = 'round';
        l.strokeStyle = N.rgba(ink, 0.06);
        l.stroke();
        l.restore();
      }
    });

    // Advance each tube's fade and see whether any is mid-change.
    let moving = false;
    for (let i = 0; i < 4; i++) {
      const st = cells[i];
      if (digits[i] !== st.cur) { st.prev = st.cur; st.cur = digits[i]; st.t0 = T.t; }
      if (T.t - st.t0 < IGNITE) moving = true;
    }

    if (!moving) {
      // One batched glow for all four lit numerals, rebuilt only on a change.
      N.layer(ctx, state, 'lit', digits, (l) => {
        N.glow(l, ink, 9, (c) => {
          for (let i = 0; i < 4; i++) {
            const tx = colX[i % 2], ty = rowY[i >> 1];
            drawGlyph(c, N, +cells[i].cur, tx + (TW - DW) / 2, ty + 56, DW, DH);
          }
        });
      });
    } else {
      for (let i = 0; i < 4; i++) {
        const tx = colX[i % 2], ty = rowY[i >> 1];
        const st = cells[i];
        const age = T.t - st.t0;
        const born = N.ease(age / FADE);
        const ign = age < IGNITE ? 0.7 + 0.3 * N.hash(Math.floor(age * 40) + i * 9) : 1;
        const dx = tx + (TW - DW) / 2, dy = ty + 56;
        if (born < 1) N.glow(ctx, ink, 9, (c) => drawGlyph(c, N, +st.prev, dx, dy, DW, DH), { intensity: 1 - born });
        N.glow(ctx, ink, 9, (c) => drawGlyph(c, N, +st.cur, dx, dy, DW, DH), { intensity: Math.max(0.01, born * ign) });
      }
    }

    // Two neon dots between the rows, on for the first half of each second.
    const on = T.sf % 1 < 0.5 ? 1 : 0.1;
    N.glowDot(ctx, ink, 484, 500, 7, 0.9 * on);
    N.glowDot(ctx, ink, 516, 500, 7, 0.9 * on);
  },
};

export default face;
