import type { NeonFace, NeonKit } from '../neon';
import { STAGE } from '../neon';

// Horizon: synthwave. A magenta grid rolls toward you, one spacing a second,
// a striped sun climbs and sets with the day behind a ridge of mountains, and
// the time hangs above it all in cyan tube digits. The sun is the clock's
// slow hand: noon is highest, night is only a glow under the horizon. An 80s
// wedge supercar (low and wide, flat roof, big rear wing on V struts, no
// badge) drives the road ahead of you, weaving between lanes, and its hot pink
// tail lights leave long-exposure trails that stream back toward you.
// Ported from docs/drafts/neon-faces/faces/horizon.js. The sun, the ridge,
// the fixed grid lines and the digits only change with the minute, so they
// are cached layers; the dark mountain plate and the rolling rungs draw live.

interface State {
  ridge?: [number, number][];
}

const CX = 500;
const HZ = 566; // vanishing point and horizon line

// The floor's own model, shared by the rungs and the car: a ground point at
// depth u (0 the horizon, 1 the viewer) sits at floorY(u), sideways offsets
// scale by spread(u) (the fan lines reach the bottom edge, y 1010, at their
// full spacing), and the floor rolls toward you at ROLL in u a second.
const ROLL = 1 / 9;
const floorY = (u: number) => HZ + 470 * u * u;
const spread = (u: number) => (470 * u * u) / (1010 - HZ);

// The car holds a fixed depth ahead of you. Its weave is a pure function of
// time, so where a tail light was d seconds ago is weave(t - d), now d * ROLL
// closer: the trail needs no stored history and curves with the weave.
const CAR_U = 0.735;
const CAR_S = spread(CAR_U);
const TRAIL_S = (1 - CAR_U) / ROLL; // seconds until a trail point leaves the bottom
const TAIL_X = 87; // tail light centres from the car's middle, at the car
const TAIL_H = 36; // tail light height above the road, at the car
const weave = (t: number) => 165 * Math.sin((t * Math.PI * 2) / 9) + 35 * Math.sin((t * Math.PI * 2) / 3.7 + 1.3);

// Rear view, origin at the middle of the road contact line, y up is negative:
// wide haunches, a low flat roof, a slit of rear window.
const BODY: [number, number][] = [
  [-120, -8], [-122, -36], [-110, -50], [-58, -56], [-44, -78],
  [44, -78], [58, -56], [110, -50], [122, -36], [120, -8],
];
const WINDOW: [number, number][] = [[-34, -73], [34, -73], [44, -61], [-44, -61]];
const TYRES: [number, number, number, number][] = [[-118, -10, 34, 16], [84, -10, 34, 16]];

function trails(ctx: CanvasRenderingContext2D, N: NeonKit, t: number) {
  const pink = N.c.pink;
  // Many short segments, each at its own fade: fewer, longer ones show their
  // steps as dashes where the trail is widest.
  const SEGS = 20;
  const STEPS = 3;
  for (let i = 0; i < SEGS; i++) {
    const fade = 1 - i / SEGS;
    const uMid = CAR_U + ((i + 0.5) / SEGS) * TRAIL_S * ROLL;
    const grow = spread(uMid) / CAR_S;
    N.glow(ctx, pink, 9 * grow, (c) => {
      for (const side of [-1, 1]) {
        for (let k = 0; k <= STEPS; k++) {
          const d = ((i + k / STEPS) / SEGS) * TRAIL_S;
          const u = CAR_U + d * ROLL;
          const sc = spread(u);
          const x = CX + (weave(t - d) + (side * TAIL_X) / CAR_S) * sc;
          const y = floorY(u) - (TAIL_H * sc) / CAR_S;
          if (k === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
      }
    }, { intensity: 1.1 * Math.pow(fade, 1.3), halo: 0.9, cap: 'butt' });
  }
}

function car(ctx: CanvasRenderingContext2D, N: NeonKit, t: number) {
  const ink = N.c.magenta;
  const pink = N.c.pink;
  const x = CX + weave(t) * CAR_S;
  const y = floorY(CAR_U);
  // Lean into the weave, a hair of suspension bob.
  const vx = ((weave(t + 0.05) - weave(t - 0.05)) / 0.1) * CAR_S;
  const lean = N.clamp(-vx * 0.0009, -0.08, 0.08);
  const bob = 1.5 * Math.sin(t * 11);

  // The tail lights on the road under the car, before the body hides them.
  N.glowDot(ctx, pink, x - TAIL_X, y + 2, 16, 0.22);
  N.glowDot(ctx, pink, x + TAIL_X, y + 2, 16, 0.22);

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(lean);
  const poly = (c: CanvasRenderingContext2D, pts: [number, number][]) => {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  };
  const tyres = (c: CanvasRenderingContext2D) => {
    for (const [tx, ty, tw, th] of TYRES) c.rect(tx, ty, tw, th);
  };
  // Dark body and tyres, so the grid stops behind the car.
  ctx.fillStyle = STAGE;
  ctx.beginPath();
  poly(ctx, BODY);
  tyres(ctx);
  ctx.fill();
  // Body outline in the scene's magenta.
  N.glow(ctx, ink, 4, (c) => poly(c, BODY), { intensity: 0.9, halo: 0.7 });
  // The wing: a flat plank wider than the roof, end plates, two V struts.
  N.glow(ctx, ink, 4, (c) => {
    c.moveTo(-118, -93);
    c.lineTo(118, -93);
    c.moveTo(-118, -86);
    c.lineTo(-118, -99);
    c.moveTo(118, -86);
    c.lineTo(118, -99);
    c.moveTo(-26, -78);
    c.lineTo(-48, -93);
    c.moveTo(26, -78);
    c.lineTo(48, -93);
  }, { intensity: 0.85, halo: 0.6 });
  // Rear window slit, bumper line, tyres: quieter.
  N.glow(ctx, ink, 2.5, (c) => {
    poly(c, WINDOW);
    c.moveTo(-116, -20);
    c.lineTo(116, -20);
    tyres(c);
  }, { intensity: 0.45, halo: 0.4 });
  // Four exhaust tips under the bumper.
  N.glow(ctx, ink, 2.5, (c) => {
    for (const ex of [-40, -22, 22, 40]) {
      c.moveTo(ex + 5, -13);
      c.arc(ex, -13, 5, 0, N.TAU);
    }
  }, { intensity: 0.6, halo: 0.3 });
  // Tail lights: wide clusters at the corners and the thin strip between.
  N.glow(ctx, pink, 11, (c) => {
    c.moveTo(-112, -TAIL_H);
    c.lineTo(-62, -TAIL_H);
    c.moveTo(62, -TAIL_H);
    c.lineTo(112, -TAIL_H);
  }, { intensity: 1, cap: 'butt' });
  N.glow(ctx, pink, 3, (c) => {
    c.moveTo(-62, -TAIL_H);
    c.lineTo(62, -TAIL_H);
  }, { intensity: 0.5, halo: 0.5, cap: 'butt' });
  ctx.restore();
}

const face: NeonFace<State> = {
  id: 'neon-horizon',
  draw(ctx, T, N, state) {
    const ink = N.c.magenta;
    const time = N.c.cyan;

    if (!state.ridge) {
      // Mountain ridge, built once: low in the middle so the sun shows,
      // taller at the sides.
      const ridge: [number, number][] = [];
      for (let i = 0; i <= 46; i++) {
        const x = 24 + i * (952 / 46);
        const side = Math.abs(x - 500) / 476;
        const jag = N.noise(i * 0.55 + 3.1) * 0.7 + N.hash(i + 40) * 0.3;
        ridge.push([x, HZ - (10 + 62 * side * side + 40 * side * jag + 12 * jag)]);
      }
      state.ridge = ridge;
    }
    const ridge = state.ridge;
    const stamp = T.hh + T.mm;

    // Sky glow and striped sun. Drawn live: cached in a layer the stacked
    // alpha clamps and the sun loses its hot centre, and it is cheap anyway.
    {
      const l = ctx;
      // Sun: noon highest, centre sinks below the line at night.
      const elev = -Math.cos(T.dayFrac * N.TAU); // -1 midnight, 1 noon
      const SR = 118;
      const sunY = HZ - 108 * elev;
      l.save();
      l.beginPath();
      l.rect(0, 0, 1000, HZ);
      l.clip();
      // Sky glow behind the sun, clipped to the sky. At night this is all that shows.
      N.glowDot(l, ink, CX, sunY, 70, 0.55 + 0.25 * Math.max(0, elev));
      N.glowDot(l, ink, CX, HZ + 40, 100, (0.55 * Math.max(0, 0.35 - elev)) / 1.35 + 0.1);

      // Striped sun: horizontal bands, gaps widening toward the bottom.
      const g = l.createLinearGradient(0, sunY - SR, 0, sunY + SR);
      g.addColorStop(0, N.rgba(N.mix(ink, '#ffffff', 0.55), 0.95));
      g.addColorStop(0.55, N.rgba(ink, 0.9));
      g.addColorStop(1, N.rgba(ink, 0.8));
      l.fillStyle = g;
      l.beginPath();
      const rows = 48;
      const rh = (2 * SR) / rows;
      const half = (y: number) => Math.sqrt(Math.max(0, SR * SR - (y - sunY) * (y - sunY)));
      for (let i = 0; i < rows; i++) {
        const f = i / rows;
        // Upper half solid; below that, cut-outs that thicken toward the bottom.
        if (f > 0.3) {
          const gapRows = 1 + Math.floor(((f - 0.3) / 0.7) * 3.4);
          if (i % 6 < gapRows) continue;
        }
        const ya = sunY - SR + i * rh;
        const yb = ya + rh + 0.4;
        const ha = half(ya + 0.01);
        const hb = half(yb - 0.01);
        l.moveTo(CX - ha, ya);
        l.lineTo(CX + ha, ya);
        l.lineTo(CX + hb, yb);
        l.lineTo(CX - hb, yb);
        l.closePath();
      }
      l.fill();
      l.restore();
    }

    // Mountains: a black silhouette that hides the sun's lower edge.
    ctx.fillStyle = STAGE;
    ctx.beginPath();
    ctx.moveTo(0, HZ + 1);
    for (const [x, y] of ridge) ctx.lineTo(x, y);
    ctx.lineTo(1000, HZ + 1);
    ctx.closePath();
    ctx.fill();

    // Everything that sits on top of the plate and does not roll: the ridge
    // edge, the fixed grid lines, the horizon line and the time.
    N.layer(ctx, state, 'fixed', stamp, (l) => {
      N.glow(l, ink, 3.5, (c) => {
        c.moveTo(ridge[0][0], ridge[0][1]);
        for (let i = 1; i < ridge.length; i++) c.lineTo(ridge[i][0], ridge[i][1]);
      }, { intensity: 0.5, halo: 0.7 });

      // The ground's long lines, fanning from the vanishing point.
      l.save();
      l.beginPath();
      l.rect(0, HZ, 1000, 500);
      l.clip();
      N.glow(l, ink, 4, (c) => {
        for (let k = -10; k <= 10; k++) {
          c.moveTo(CX, HZ);
          c.lineTo(CX + k * 150, 1010);
        }
      }, { intensity: 0.24, halo: 0.7 });
      l.restore();

      // The horizon line itself, hot.
      N.glow(l, ink, 4.5, (c) => {
        c.moveTo(30, HZ);
        c.lineTo(970, HZ);
      }, { intensity: 0.85 });

      // The time: cyan seven-segment tubes, the one thing at full intensity.
      const DW = 84, DH = 172, GAP = 26, COLON = 62;
      const pair = DW * 2 + GAP;
      const x0 = CX - (pair * 2 + COLON) / 2;
      const y0 = 138;
      const digits = [T.hh[0], T.hh[1], T.mm[0], T.mm[1]];
      const px = [x0, x0 + DW + GAP, x0 + pair + COLON, x0 + pair + COLON + DW + GAP];
      N.glow(l, time, 3, (c) => {
        for (let i = 0; i < 4; i++) N.seg7(c, digits[i], px[i], y0, DW, DH, { off: true, gap: 9 });
      }, { intensity: 0.1, halo: 0 });
      N.glow(l, time, 14, (c) => {
        for (let i = 0; i < 4; i++) N.seg7(c, digits[i], px[i], y0, DW, DH, { gap: 9 });
      }, { intensity: 1 });
    });

    // The rolling rungs. Rungs roll toward you, one spacing a second.
    const fr = T.sf % 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HZ, 1000, 500);
    ctx.clip();
    const rungs = 9;
    for (let j = 0; j < rungs; j++) {
      const u = (j + fr) / rungs; // 0 at the horizon, 1 at the viewer
      const y = floorY(u);
      const near = 0.2 + 0.7 * u;
      N.glow(ctx, ink, 3.5 + 2.5 * u, (c) => {
        c.moveTo(0, y);
        c.lineTo(1000, y);
      }, { intensity: near * (u < 0.06 ? u / 0.06 : 1), halo: 0.8 });
    }
    ctx.restore();

    // The car and its trails, over the floor, under nothing. Trails first so
    // the body covers where they start.
    trails(ctx, N, T.t);
    car(ctx, N, T.t);

    // The colon: two cyan dots that breathe once a second.
    const DH = 172, y0 = 138, DW = 84, GAP = 26, COLON = 62;
    const colonX = CX - (DW * 4 + GAP * 2 + COLON) / 2 + (DW * 2 + GAP) + COLON / 2;
    const on = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(N.TAU * fr));
    N.glowDot(ctx, time, colonX, y0 + DH * 0.3, 8, on);
    N.glowDot(ctx, time, colonX, y0 + DH * 0.7, 8, on);
  },
};

export default face;
