// Spiro: a spirograph drawn in pink tube. The hour picks the gear train
// (outer ring R, rolling ring r, pen offset d), so every hour has its own
// figure; the pen finishes one lap per minute and the finished figure fades
// out over the first three seconds of the next. HH:MM floats over the middle.
NEON.face({
  id: 'spiro',
  name: 'Spiro',
  hue: 'pink',
  idea: 'A spirograph in pink tube. The hour chooses the gear ratios so each hour draws its own figure; a bright pen finishes it once a minute, and the time floats in thin tube digits over the middle.',
  draw(ctx, T, N, state) {
    const CX = 500, CY = 500;
    const ink = N.c.pink;
    const STEPS = 230;

    // Gear trains [R, r, d/r]; gcd(R, r) is 1 so each closes after r laps.
    const TRAINS = [
      [5, 3, 1.25], [7, 2, 1.5], [8, 3, 1.15], [9, 4, 1.45], [11, 3, 1.05], [10, 3, 1.3],
      [7, 3, 1.7], [13, 5, 1.2], [9, 2, 1.25], [12, 5, 1.5], [11, 4, 1.35], [6, 5, 1.4],
    ];
    // Points of the whole figure for an hour, scaled to fill the disc.
    const figure = (h) => {
      const key = 'f' + h;
      if (state[key]) return state[key];
      const [R, r, dk] = TRAINS[h % 12];
      const d = r * (h < 12 ? dk : dk * 0.62 + 0.3);   // afternoons get a rounder cousin
      const s = 436 / (R - r + d);
      const pts = [];
      for (let i = 0; i <= STEPS; i++) {
        const th = (i / STEPS) * N.TAU * r;
        const k = (R - r) / r;
        pts.push([
          CX + s * ((R - r) * Math.cos(th) + d * Math.cos(k * th)),
          CY + s * ((R - r) * Math.sin(th) - d * Math.sin(k * th)),
        ]);
      }
      state[key] = pts;
      return pts;
    };

    // A smoothed path through the first `n` points plus a fractional last one.
    const trace = (pts, f) => (c) => {
      const last = f * STEPS;
      const n = Math.floor(last);
      if (n < 1) return;
      const frac = last - n;
      const [ax, ay] = pts[Math.min(STEPS, n)];
      const [bx, by] = pts[Math.min(STEPS, n + 1)];
      const ex = ax + (bx - ax) * frac, ey = ay + (by - ay) * frac;
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      c.lineTo(ex, ey);
    };

    // The figure that just finished, still fading for 3 s.
    if (T.sf < 3) {
      const ph = T.m === 0 ? (T.h + 23) % 24 : T.h;
      N.glow(ctx, ink, 4, trace(figure(ph), 1), { intensity: 1 * (1 - N.ease(T.sf / 3)) });
    }

    // The figure being drawn this minute.
    const pts = figure(T.h);
    const f = T.minuteFrac;
    N.glow(ctx, ink, 4, trace(pts, f), { intensity: 1 });

    // The pen head.
    const idx = f * STEPS;
    const i0 = Math.floor(idx), i1 = Math.min(STEPS, i0 + 1);
    const px = pts[i0][0] + (pts[i1][0] - pts[i0][0]) * (idx - i0);
    const py = pts[i0][1] + (pts[i1][1] - pts[i0][1]) * (idx - i0);
    N.glowDot(ctx, ink, px, py, 9, 1);

    // A calm patch behind the time so the figure does not fight it.
    const hole = ctx.createRadialGradient(CX, CY, 120, CX, CY, 290);
    hole.addColorStop(0, 'rgba(4,4,10,0.94)');
    hole.addColorStop(0.6, 'rgba(4,4,10,0.8)');
    hole.addColorStop(1, 'rgba(4,4,10,0)');
    ctx.save();
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(CX, CY, 290, 0, N.TAU);
    ctx.fill();
    ctx.restore();

    // The time: thin pink tube segments.
    const DW = 76, DH = 160, GAP = 24, COLON = 50;
    const pair = DW * 2 + GAP;
    const x0 = CX - (pair * 2 + COLON) / 2;
    const y0 = CY - DH / 2;
    const ch = [T.hh[0], T.hh[1], T.mm[0], T.mm[1]];
    const px0 = [x0, x0 + DW + GAP, x0 + pair + COLON, x0 + pair + COLON + DW + GAP];
    N.glow(ctx, ink, 8, (c) => {
      for (let i = 0; i < 4; i++) N.seg7(c, ch[i], px0[i], y0, DW, DH, { gap: 7 });
    }, { intensity: 1 });
    const colonX = x0 + pair + COLON / 2;
    const beat = 0.6 + 0.4 * (0.5 + 0.5 * Math.cos(N.TAU * (T.sf % 1)));
    N.glowDot(ctx, ink, colonX, CY - 38, 7, beat);
    N.glowDot(ctx, ink, colonX, CY + 38, 7, beat);
  },
});
