import type { NeonFace } from '../neon';

// Sign: HH:MM as bar-sign lettering. Every numeral is one bent glass tube
// (straight runs and round bends, never seven segments). Where a real glass
// bender would have to jump to a new stroke, the blacked-out return tube is
// painted dim. Small standoffs hold the tube to the wall, the colon breathes
// once a second, and once a minute one stroke stutters like a tired ballast.
// Ported from docs/drafts/neon-faces/faces/sign.js. The numerals, standoffs
// and wall wash change once a minute, so they live in one cached layer; only
// the stuttering stroke and the colon draw live.

type Pt = readonly [number, number, number?];
type Stroke = readonly Pt[];

interface State {
  ready?: boolean;
  font?: Record<string, Stroke[]>;
}

const W = 140;
const H = 270; // one numeral cell
const PITCH = 182; // digit-to-digit spacing inside HH or MM
const COLON_GAP = 100; // clear space between the two pairs
const CY = 500;
const PAIR = PITCH + W;
const X0 = 500 - (PAIR * 2 + COLON_GAP) / 2;
const Y0 = CY - H / 2;
const CELL = [0, PITCH, PAIR + COLON_GAP, PAIR + COLON_GAP + PITCH];
// The "1" is drawn left-heavy; nudge it to the middle of its cell.
const shiftOf = (ch: string) => (ch === '1' ? 28 : ch === '7' ? 8 : 0);

function buildFont(): Record<string, Stroke[]> {
  // A numeral is a list of strokes; a stroke is a list of [x, y, bendRadius]
  // points, drawn with arcTo so every corner is a real bent tube.
  const F: Record<string, Stroke[]> = {
    0: [[[70, 0], [140, 0, 70], [140, H, 70], [0, H, 70], [0, 0, 70], [70, 0]]],
    1: [[[14, 66], [70, 0, 5], [70, H]]],
    2: [[[0, 70], [0, 0, 70], [140, 0, 70], [140, 110, 46], [0, H, 6], [140, H]]],
    3: [
      [[0, 64], [0, 0, 64], [140, 0, 64], [140, 135, 64], [46, 135]],
      [[46, 135], [140, 135, 67], [140, H, 67], [0, H, 67], [0, 206]],
    ],
    4: [[[112, H], [112, 0, 5], [0, 188, 5], [140, 188]]],
    5: [[[140, 0], [12, 0, 6], [12, 128, 6], [140, 128, 66], [140, H, 66], [0, H]]],
    6: [[[132, 0], [0, 0, 44], [0, H, 70], [140, H, 70], [140, 134, 66], [0, 134]]],
    7: [[[0, 0], [140, 0, 5], [48, H]]],
    8: [
      [[70, 135], [140, 135, 67], [140, 0, 67], [0, 0, 67], [0, 135, 67], [70, 135]],
      [[70, 135], [0, 135, 67], [0, H, 67], [140, H, 67], [140, 135, 67], [70, 135]],
    ],
  };
  // A nine is a six hung upside down.
  F[9] = F[6].map((s) => s.map(([x, y, r]) => [140 - x, H - y, r] as Pt));
  return F;
}

const bend = (c: CanvasRenderingContext2D, pts: Stroke, ox: number, oy: number) => {
  c.moveTo(ox + pts[0][0], oy + pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    c.arcTo(ox + pts[i][0], oy + pts[i][1], ox + pts[i + 1][0], oy + pts[i + 1][1], pts[i][2] || 6);
  }
  const e = pts[pts.length - 1];
  c.lineTo(ox + e[0], oy + e[1]);
};

const face: NeonFace<State> = {
  id: 'neon-sign',
  draw(ctx, T, N, state) {
    const ink = N.c.pink;
    const font = (state.font ??= buildFont());
    const chars = [T.hh[0], T.hh[1], T.mm[0], T.mm[1]];
    const originX = (d: number) => X0 + CELL[d] + shiftOf(chars[d]);

    // The stuttering stroke: same minute, same stroke, every time.
    const sv = N.hash(T.h * 60 + T.m + 0.5);
    const sd = Math.min(3, Math.floor(sv * 4));
    const ss = Math.floor(N.hash(T.h * 60 + T.m + 9.5) * font[chars[sd]].length);
    const t0 = 6 + Math.floor(N.hash(T.h * 60 + T.m + 3.5) * 40);
    const u = T.sf - t0;
    const dip = (u >= 0 && u < 0.15) || (u >= 0.26 && u < 0.41);
    // A tube also hums a little.
    const hum = 0.95 + 0.05 * N.noise(T.t * 2.3);
    // The cached tubes hold the hum's mean; the hum itself only moves the
    // one live stroke, a few percent either way.
    const HUM_MEAN = 0.975;

    N.layer(ctx, state, 'sign', T.hh + T.mm, (l) => {
      // A very soft wash of light on the wall behind the sign.
      const wash = l.createRadialGradient(500, CY, 40, 500, CY, 430);
      wash.addColorStop(0, N.rgba(ink, 0.11));
      wash.addColorStop(1, N.rgba(ink, 0));
      l.fillStyle = wash;
      l.fillRect(0, 0, 1000, 1000);

      l.save();
      l.translate(500, 500);
      l.scale(1.1, 1.1);
      l.translate(-500, -500);

      // Standoffs: little posts where the tube is clipped to the wall, and
      // the dark return tubes joining one stroke to the next.
      l.save();
      l.fillStyle = N.rgba(ink, 0.5);
      l.strokeStyle = N.rgba(ink, 0.12);
      l.lineWidth = 11;
      l.lineCap = 'round';
      l.beginPath();
      for (let d = 0; d < 4; d++) {
        const ox = originX(d);
        const strokes = font[chars[d]];
        for (let s = 0; s < strokes.length; s++) {
          const p = strokes[s];
          const a = p[0];
          const z = p[p.length - 1];
          l.moveTo(ox + z[0], Y0 + z[1]);
          if (s + 1 < strokes.length) {
            const nx = strokes[s + 1][0];
            l.lineTo(ox + nx[0], Y0 + nx[1]);
          }
          l.moveTo(ox + a[0], Y0 + a[1]);
        }
      }
      l.stroke();
      l.beginPath();
      for (let d = 0; d < 4; d++) {
        const ox = originX(d);
        for (const p of font[chars[d]]) {
          for (let i = 0; i < p.length - 1; i++) {
            const ax = p[i][0], ay = p[i][1], bx = p[i + 1][0], by = p[i + 1][1];
            const len = Math.hypot(bx - ax, by - ay);
            const need = (p[i][2] || 0) * (i > 0 ? 1 : 0) + (p[i + 1][2] || 0) * (i + 1 < p.length - 1 ? 1 : 0);
            if (len < need + 40) continue;
            const mx = ox + (ax + bx) / 2, my = Y0 + (ay + by) / 2;
            l.moveTo(mx + 6, my);
            l.arc(mx, my, 6, 0, N.TAU);
          }
        }
      }
      l.fill();
      l.restore();

      // The lit tube, every stroke but the one that stutters this minute.
      for (let d = 0; d < 4; d++) {
        const ox = originX(d);
        const strokes = font[chars[d]];
        for (let s = 0; s < strokes.length; s++) {
          if (d === sd && s === ss) continue;
          N.glow(l, ink, 14, (c) => bend(c, strokes[s], ox, Y0), { intensity: HUM_MEAN });
        }
      }
      l.restore();
    });

    ctx.save();
    ctx.translate(500, 500);
    ctx.scale(1.1, 1.1);
    ctx.translate(-500, -500);
    N.glow(ctx, ink, 14, (c) => bend(c, font[chars[sd]][ss], originX(sd), Y0), {
      intensity: (dip ? 0.14 : 1) * hum,
    });

    // Colon: two tube dots that breathe once a second.
    const cx = X0 + PAIR + COLON_GAP / 2;
    const breathe = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(N.TAU * (T.sf % 1)));
    N.glowDot(ctx, ink, cx, CY - 52, 12, breathe);
    N.glowDot(ctx, ink, cx, CY + 52, 12, breathe);
    ctx.restore();
  },
};

export default face;
