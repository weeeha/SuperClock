// Laser: the hour and minute hands are beams that cut clean across the whole
// disc. The pointing half burns at full power, the far half is a ghost, so
// direction reads. Where a beam meets the rim it throws sparks; dust in the
// air lights up as it drifts through a beam. No seconds, on purpose.
NEON.face({
  id: 'laser',
  name: 'Laser',
  hue: 'red',
  idea: 'Two laser beams cross the disc through the centre: wide hour, thin minute, bright on the pointing side and a faint guide line on the far side. Sparks jitter where they hit the rim and dust motes flare as they drift through the light.',
  draw(ctx, T, N, state) {
    const CX = 500, CY = 500;
    const ink = N.c.red;
    const R = 468;
    const hum = 0.96 + 0.04 * N.noise(T.t * 6.1);

    if (!state.ready) {
      state.motes = [];
      for (let i = 0; i < 40; i++) {
        state.motes.push({
          a: N.hash(i * 3.1) * N.TAU,
          r: Math.sqrt(N.hash(i * 5.7 + 1)) * 440,
          vr: (N.hash(i * 7.3 + 2) - 0.5) * 6,
          va: (N.hash(i * 11.9 + 3) - 0.5) * 0.05,
          s: 1.4 + N.hash(i * 2.3 + 4) * 1.8,
        });
      }
      state.ready = true;
    }

    // Hour dots on the rim, dim.
    for (let i = 0; i < 12; i++) {
      const [x, y] = N.polar(CX, CY, R, i * 30);
      N.glowDot(ctx, ink, x, y, i % 3 === 0 ? 4.5 : 3, 0.28);
    }

    // Dust: seed positions drift slowly, wrap at the rim, and flare near a
    // beam. Distance to a beam is the cross product with its direction.
    const dirs = [N.polar(0, 0, 1, T.hourDeg), N.polar(0, 0, 1, T.minuteDeg)];
    for (const m of state.motes) {
      const a = m.a + m.va * T.t;
      const r = ((m.r + m.vr * T.t) % 440 + 440) % 440;
      const x = CX + r * Math.cos(a), y = CY + r * Math.sin(a);
      let near = 0;
      for (const [dx, dy] of dirs) {
        const d = Math.abs((x - CX) * dy - (y - CY) * dx);
        near = Math.max(near, N.clamp(1 - d / 45, 0, 1));
      }
      const twinkle = 0.7 + 0.3 * Math.sin(T.t * 1.5 + m.a * 9);
      N.glowDot(ctx, ink, x, y, m.s * 1.3 * (1 + near * 0.8), (0.22 + near * 0.78) * twinkle);
    }

    // A beam: far half dim, pointing half at full power. Laser light is
    // narrow and hot, so the core is wide relative to the halo.
    const beam = (deg, w) => {
      const [fx, fy] = N.polar(CX, CY, R, deg);
      const [bx, by] = N.polar(CX, CY, -R, deg);
      N.glow(ctx, ink, w * 0.5, (c) => { c.moveTo(CX, CY); c.lineTo(bx, by); }, { intensity: 0.08 * hum, halo: 0.6 });
      N.glow(ctx, ink, w, (c) => { c.moveTo(CX, CY); c.lineTo(fx, fy); }, { intensity: hum });
    };
    beam(T.hourDeg, 28);
    beam(T.minuteDeg, 17.5);

    // Impact flares and sparks where a beam meets the rim. Jitter changes
    // 20 times a second, from a hash of the step.
    const step = Math.floor(T.t * 20);
    const impact = (deg, size, k, seed) => {
      const [x, y] = N.polar(CX, CY, R, deg);
      N.glowDot(ctx, ink, x, y, size, k);
      const n = k > 0.5 ? 4 : 2;
      N.glow(ctx, ink, 3.5, (c) => {
        for (let i = 0; i < n; i++) {
          const j = N.hash(step * 13.7 + i * 3.3 + seed);
          // Sparks skid along the rim either side of the hit, one fires inward.
          const side = i % 2 ? 1 : -1;
          const ang = deg + 180 + (i === 3 ? (j - 0.5) * 40 : side * (68 + j * 44));
          const len = size * (0.9 + N.hash(step * 5.1 + i + seed) * 2.4);
          const [x2, y2] = N.polar(x, y, len, ang);
          c.moveTo(x, y);
          c.lineTo(x2, y2);
        }
      }, { intensity: k, halo: 0.5 });
    };
    impact(T.hourDeg, 17, 1, 1);
    impact(T.minuteDeg, 12, 1, 7);
    impact(T.hourDeg + 180, 10, 0.3, 3);
    impact(T.minuteDeg + 180, 8, 0.3, 9);

    // The crossing at the centre: a hot point where the two meet.
    N.glowDot(ctx, ink, CX, CY, 15, 1);
    N.glowDot(ctx, N.c.white, CX, CY, 4, 0.5);
  },
});
