import type { NeonFace, NeonKit, NeonTime } from '../neon';

// Plasma: a plasma globe. Eight dim filaments crawl from the electrode to the
// glass and keep clear of two bright ones. The thick filament lands on the
// glass at the hour, the thinner one at the minute, and each contact spot
// burns hotter than the filament that feeds it. Ported from
// docs/drafts/neon-faces/faces/plasma.js: the glass, rim and electrode never
// change, so they are one static layer.

interface State { ready?: boolean }

const CX = 500;
const CY = 500;
const GLASS = 480;
const REACH = 466;
const AMBIENT = 8;
const SEP = 30; // degrees ambient filaments keep from a hand

// Angular difference b - a, wrapped to -180..180.
const dAng = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

// A jagged, wandering path from the electrode to the glass. `ang` is where it
// lands, `amp` how far it may stray sideways; the wander is zero at both ends.
function filament(N: NeonKit, T: NeonTime, seed: number, ang: number, reach: number, amp: number, steps: number, speed: number): number[] {
  const pts: number[] = [];
  const a = ((ang - 90) * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);
  const nx = -uy, ny = ux;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const r = 52 + (reach - 52) * u;
    const env = Math.sin(Math.PI * u) ** 0.7;
    const slow = N.noise(u * 3.2 + T.t * 0.35 * speed + seed * 17) - 0.5;
    const fast = N.noise(u * 11 + T.t * 2.4 * speed + seed * 31) - 0.5;
    const off = (slow * 1.6 + fast * 0.9) * amp * env;
    pts.push(CX + ux * r + nx * off, CY + uy * r + ny * off);
  }
  return pts;
}
const trace = (c: CanvasRenderingContext2D, pts: number[]) => {
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
};

const face: NeonFace<State> = {
  id: 'neon-plasma',
  draw(ctx, T, N, state) {
    const ink = N.c.violet;

    // The glass: a faint sphere with a rim and one soft highlight, and the
    // electrode: a hot ball with a small ring around it.
    N.layer(ctx, state, 'glass', 'static', (l) => {
      const g = l.createRadialGradient(CX, CY, 40, CX, CY, GLASS);
      g.addColorStop(0, N.rgba(ink, 0.1));
      g.addColorStop(0.6, N.rgba(ink, 0.03));
      g.addColorStop(1, N.rgba(ink, 0.07));
      l.fillStyle = g;
      l.beginPath();
      l.arc(CX, CY, GLASS, 0, N.TAU);
      l.fill();
      N.glow(l, ink, 3, (c) => c.arc(CX, CY, GLASS, 0, N.TAU), { intensity: 0.22, halo: 0.4 });
      N.glow(l, N.c.white, 3, (c) => c.arc(CX, CY, GLASS - 22, Math.PI * 1.08, Math.PI * 1.33), { intensity: 0.08, halo: 0, core: false });
      N.glowDot(l, ink, CX, CY, 34, 1);
      N.glowDot(l, N.c.white, CX, CY, 12, 0.8);
      N.glow(l, ink, 6, (c) => c.arc(CX, CY, 44, 0, N.TAU), { intensity: 0.7 });
    });

    // Ambient filaments, evenly spread, drifting, and shoved aside near hands.
    const amb: number[][] = [];
    const lit: number[] = [];
    for (let i = 0; i < AMBIENT; i++) {
      let ang = (i * 360) / AMBIENT + 40 * Math.sin(T.t * 0.07 + i * 2.1) + 25 * Math.sin(T.t * 0.11 + i);
      let fade = 1;
      for (const h of [T.hourDeg, T.minuteDeg]) {
        const d = dAng(h, ang);
        if (Math.abs(d) < SEP) {
          fade = Math.min(fade, N.ease(Math.abs(d) / SEP));
          ang = h + (d < 0 ? -SEP : SEP);
        }
      }
      amb.push(filament(N, T, i + 1, ang, 440 + 38 * N.hash(i + 5), 90, 16, 1));
      lit.push(fade);
    }
    // One glow call per brightness band (the draft skips the dimmest band).
    const bands = [0, 0.5, 0.85];
    for (let b = 1; b < bands.length; b++) {
      const lo = bands[b], hi = bands[b + 1] ?? 1.01;
      const idx: number[] = [];
      for (let i = 0; i < AMBIENT; i++) if (lit[i] >= lo && lit[i] < hi) idx.push(i);
      if (!idx.length) continue;
      N.glow(ctx, ink, 2.6, (c) => { for (const i of idx) trace(c, amb[i]); }, { intensity: 0.3 * (b === 1 ? 0.6 : 1), halo: 0.8 });
      for (const i of idx) {
        const p = amb[i];
        N.glowDot(ctx, ink, p[p.length - 2], p[p.length - 1], 6, 0.3 * lit[i]);
      }
    }

    // The hands: hour thick, minute thin.
    const hourPts = filament(N, T, 41, T.hourDeg, REACH, 26, 22, 0.8);
    const minPts = filament(N, T, 53, T.minuteDeg, REACH, 22, 22, 0.8);
    N.glow(ctx, ink, 11, (c) => trace(c, minPts), { intensity: 1 });
    N.glow(ctx, ink, 17, (c) => trace(c, hourPts), { intensity: 1 });

    // Contact spots on the glass, brightest points on the dial.
    const flick = 0.88 + 0.12 * N.noise(T.t * 9);
    N.glowDot(ctx, ink, minPts[minPts.length - 2], minPts[minPts.length - 1], 13, flick);
    N.glowDot(ctx, ink, hourPts[hourPts.length - 2], hourPts[hourPts.length - 1], 20, flick);
  },
};

export default face;
