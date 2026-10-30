// Tunnel: ten magenta rings rush out of a vanishing point near the centre,
// one ring leaving the rim every second. Every ring carries two bright arcs,
// a wide one at the hour angle and a narrow one at the minute angle, so the
// rings draw two streaks that point at the time. Motion is steady and slow
// (the same speed all minute, no pulsing), so it stays calm.
NEON.face({
  id: 'tunnel',
  name: 'Tunnel',
  hue: 'magenta',
  idea: 'A calm magenta tunnel: rings stream out of the centre, one reaching the rim each second, each carrying a wide arc at the hour angle and a narrow arc at the minute angle, so two streaks point at the time.',
  draw(ctx, T, N, state) {
    const ink = N.c.magenta;
    const RINGS = 10, RMAX = 500;
    const frac = T.sf % 1;
    // Vanishing point drifts a few units; rings blend back to the true centre
    // as they approach, so the tunnel bends slightly.
    const vx = 500 + 14 * Math.sin(T.t * 0.31), vy = 500 + 10 * Math.cos(T.t * 0.23);
    const rad = (deg) => ((deg - 90) * Math.PI) / 180;

    // Distant glow at the vanishing point, so the tunnel has a far end.
    N.glowDot(ctx, ink, vx, vy, 12, 0.4);

    // Draw far to near so near rings sit on top.
    for (let i = 0; i < RINGS; i++) {
      const u = (i + frac) / RINGS;                  // 0 far, 1 at the rim
      const r = 36 + (RMAX - 36) * Math.pow(u, 1.55); // spacing opens up as rings near
      const cx = vx + (500 - vx) * u, cy = vy + (500 - vy) * u;
      // Rings leaving the rim fade as the bezel takes them.
      const edge = 1 - N.clamp((r - 455) / 60, 0, 1);
      const b = (0.15 + 0.85 * u) * edge;
      if (b <= 0.01) continue;
      const s = 0.35 + 0.65 * u;                     // line weight grows near

      // The ring itself: dim structure.
      N.glow(ctx, ink, 4 * s + 1, (c) => c.arc(cx, cy, r, 0, N.TAU), { intensity: 0.22 * b, halo: 0.7 });
      // Hour arc: wide in angle and heavy.
      N.glow(ctx, ink, 22 * s + 3, (c) => {
        c.arc(cx, cy, r, rad(T.hourDeg - 13), rad(T.hourDeg + 13));
      }, { intensity: b });
      // Minute arc: narrow in angle, slimmer, hot.
      N.glow(ctx, ink, 8 * s + 2, (c) => {
        c.arc(cx, cy, r, rad(T.minuteDeg - 8), rad(T.minuteDeg + 8));
      }, { intensity: b });
    }
  },
});
