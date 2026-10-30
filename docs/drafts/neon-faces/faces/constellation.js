// Constellation: a violet night sky. HH:MM is drawn as star figures: each
// numeral is a few bright star nodes on a 3 by 5 grid joined by thin lines.
// A changed digit draws its lines in over 0.8 s. About 180 faint stars twinkle
// slowly behind, and a satellite orbits the rim with the seconds.
NEON.face({
  id: 'constellation',
  name: 'Constellation',
  hue: 'violet',
  idea: 'The time as star figures: bright nodes on a 3 by 5 grid joined by thin lines, over a slowly twinkling sky. A changed digit draws its lines in; a satellite circles the rim once a minute.',
  draw(ctx, T, N, state) {
    const ink = N.c.violet;

    if (!state.ready) {
      // Background stars on a rejection-free spiral scatter, stable per index.
      state.stars = [];
      for (let i = 0; i < 180; i++) {
        const r = 485 * Math.sqrt(N.hash(i * 3 + 1));
        const a = N.hash(i * 3 + 2) * N.TAU;
        state.stars.push({
          x: 500 + r * Math.cos(a), y: 500 + r * Math.sin(a),
          size: 1.2 + N.hash(i * 3 + 3) * 2.2,
          speed: 0.3 + N.hash(i + 900) * 0.7,
          phase: N.hash(i + 400) * N.TAU,
          big: i % 15 === 0,
        });
      }
      // Numerals as polylines over grid nodes [col 0..2, row 0..4].
      state.glyph = {
        0: [[[0, 0], [2, 0], [2, 4], [0, 4], [0, 0]]],
        1: [[[0, 1], [1, 0], [1, 4]], [[0, 4], [2, 4]]],
        2: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 4], [2, 4]]],
        3: [[[0, 0], [2, 0], [2, 4], [0, 4]], [[0, 2], [2, 2]]],
        4: [[[0, 0], [0, 2], [2, 2]], [[2, 0], [2, 4]]],
        5: [[[2, 0], [0, 0], [0, 2], [2, 2], [2, 4], [0, 4]]],
        6: [[[2, 0], [0, 0], [0, 4], [2, 4], [2, 2], [0, 2]]],
        7: [[[0, 0], [2, 0], [1, 4]]],
        8: [[[0, 0], [2, 0], [2, 4], [0, 4], [0, 0]], [[0, 2], [2, 2]]],
        9: [[[2, 2], [0, 2], [0, 0], [2, 0], [2, 4], [0, 4]]],
      };
      state.shown = ['', '', '', ''];
      state.changed = [-99, -99, -99, -99];
      state.ready = true;
    }

    // Deep sky: dim, twinkling points. Faint ones are one fillRect each at a
    // per-star alpha; the few big ones get a small glow.
    ctx.save();
    ctx.fillStyle = ink;
    for (const s of state.stars) {
      const tw = 0.5 + 0.5 * Math.sin(T.t * s.speed + s.phase);
      ctx.globalAlpha = 0.18 + 0.45 * tw * tw;
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size * 1.2, s.size * 1.2);
    }
    ctx.restore();
    for (const s of state.stars) {
      if (!s.big) continue;
      const tw = 0.5 + 0.5 * Math.sin(T.t * s.speed + s.phase);
      N.glowDot(ctx, ink, s.x, s.y, 3, 0.15 + 0.2 * tw);
    }

    // Layout: four 3x5 figures with a two-star colon.
    const CW = 54, CH = 56;       // node pitch: figure is 108 x 224
    const FW = CW * 2, GAP = 40, COLON = 64;
    const total = 4 * FW + 2 * GAP + COLON;
    const x0 = 500 - total / 2, y0 = 500 - CH * 2;
    const fx = [x0, x0 + FW + GAP, x0 + 2 * FW + GAP + COLON, x0 + 3 * FW + 2 * GAP + COLON];
    const chars = T.hh + T.mm;
    for (let i = 0; i < 4; i++) {
      if (state.shown[i] !== chars[i]) {
        // First frame: already complete. Afterwards: start the draw-in.
        state.changed[i] = state.shown[i] === '' ? -99 : T.t;
        state.shown[i] = chars[i];
      }
    }

    const drawIn = (i) => N.ease((T.t - state.changed[i]) / 0.8);
    for (let i = 0; i < 4; i++) {
      const p = drawIn(i);
      const paths = state.glyph[chars[i]];
      let len = 0;
      for (const pl of paths) for (let k = 1; k < pl.length; k++) len += Math.hypot(pl[k][0] - pl[k - 1][0], pl[k][1] - pl[k - 1][1]);
      const goal = len * p;
      const tx = (n) => fx[i] + n[0] * CW;
      const ty = (n) => y0 + n[1] * CH;
      N.glow(ctx, ink, 5, (c) => {
        let acc = 0;
        for (const pl of paths) {
          c.moveTo(tx(pl[0]), ty(pl[0]));
          for (let k = 1; k < pl.length; k++) {
            const a = pl[k - 1], b = pl[k];
            const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (acc >= goal) break;
            const u = Math.min(1, (goal - acc) / seg);
            c.lineTo(tx(a) + (tx(b) - tx(a)) * u, ty(a) + (ty(b) - ty(a)) * u);
            acc += seg;
          }
        }
      }, { intensity: 1, halo: 1.3 });
      // Star nodes appear as the line reaches them.
      const seen = new Set();
      const lit = [];
      let acc = 0;
      for (const pl of paths) {
        for (let k = 0; k < pl.length; k++) {
          if (k > 0) acc += Math.hypot(pl[k][0] - pl[k - 1][0], pl[k][1] - pl[k - 1][1]);
          if (acc > goal + 1e-6) break;
          const key = pl[k][0] + ',' + pl[k][1];
          if (seen.has(key)) continue;
          seen.add(key);
          lit.push(pl[k]);
        }
      }
      for (const n of lit) {
        const tw = 0.9 + 0.1 * Math.sin(T.t * 1.3 + n[0] * 2 + n[1] * 3 + i);
        N.glowDot(ctx, ink, tx(n), ty(n), 11, tw);
        N.glowDot(ctx, ink, tx(n), ty(n), 6, tw);
      }
    }
    // Colon: two stars.
    const cxs = x0 + 2 * FW + GAP + COLON / 2;
    N.glowDot(ctx, ink, cxs, y0 + CH * 1.2, 10, 1);
    N.glowDot(ctx, ink, cxs, y0 + CH * 2.8, 10, 1);

    // Satellite: a bright point with a short fading tail around r 455.
    for (let k = 14; k >= 1; k--) {
      const [x, y] = N.polar(500, 500, 455, T.sweepDeg - k * 1.1);
      N.glowDot(ctx, ink, x, y, 3.5, 0.04 + 0.01 * (14 - k));
    }
    const [sx, sy] = N.polar(500, 500, 455, T.sweepDeg);
    N.glowDot(ctx, ink, sx, sy, 8, 1);
  },
});
