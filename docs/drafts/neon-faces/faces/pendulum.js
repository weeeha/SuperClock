// Pendulum: a blue pendulum on a one-second beat (it crosses the bottom once
// a second, at the swing's centre) hung in front of thin blue tube digits
// showing HH:MM. The bob drags a short fading light trail; a faint arc scale
// under it marks the swing.
NEON.face({
  id: 'pendulum',
  name: 'Pendulum',
  hue: 'blue',
  idea: 'A pendulum swinging in front of thin blue tube digits, crossing the bottom of its arc exactly on each second and trailing a fading comet of light.',
  draw(ctx, T, N, state) {
    const ink = N.c.blue;
    const PX = 500, PY = 450, ROD = 300, BOB = 42, MAX = 18;
    const swing = (sf) => MAX * Math.sin(Math.PI * sf);
    const bobAt = (sf) => N.polar(PX, PY, ROD, 180 + swing(sf));
    const hum = 0.95 + 0.05 * N.noise(T.t * 1.9);

    // HH:MM behind everything: thin tube digits, about 190 tall.
    const DW = 88, DH = 190, GAP = 26, COL = 56;
    const total = 4 * DW + 2 * GAP + COL;
    const x0 = 500 - total / 2, y0 = 205;
    const xs = [x0, x0 + DW + GAP, x0 + 2 * DW + GAP + COL, x0 + 3 * DW + 2 * GAP + COL];
    const chars = T.hh + T.mm;
    N.glow(ctx, ink, 10, (c) => {
      for (let i = 0; i < 4; i++) N.seg7(c, chars[i], xs[i], y0, DW, DH, { gap: 6 });
    }, { intensity: 0.95 * hum });
    // Unlit segments of the same tubes, barely there.
    N.glow(ctx, ink, 10, (c) => {
      for (let i = 0; i < 4; i++) N.seg7(c, chars[i], xs[i], y0, DW, DH, { gap: 6, off: true });
    }, { intensity: 0.05, halo: 0, core: false });
    // Colon: two tube dots.
    const ccx = x0 + 2 * DW + GAP + COL / 2;
    N.glow(ctx, ink, 10, (c) => {
      c.moveTo(ccx, y0 + DH * 0.3); c.lineTo(ccx, y0 + DH * 0.3 + 8);
      c.moveTo(ccx, y0 + DH * 0.7); c.lineTo(ccx, y0 + DH * 0.7 + 8);
    }, { intensity: 0.95 * hum });

    // Arc scale under the bob: ticks every 6 degrees, the centre and the
    // extremes a little brighter.
    const SR = 372;
    ctx.save();
    ctx.strokeStyle = N.rgba(ink, 0.2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(PX, PY, SR, ((90 - 24) * Math.PI) / 180, ((90 + 24) * Math.PI) / 180);
    ctx.stroke();
    ctx.restore();
    N.glow(ctx, ink, 4, (c) => {
      for (let d = -24; d <= 24; d += 6) {
        const big = d === 0 || Math.abs(d) === MAX;
        const [x1, y1] = N.polar(PX, PY, SR - (big ? 24 : 12), 180 + d);
        const [x2, y2] = N.polar(PX, PY, SR, 180 + d);
        c.moveTo(x1, y1); c.lineTo(x2, y2);
      }
    }, { intensity: 0.3, halo: 0.5 });

    // Trail: the bob's recent positions, each dimmer and smaller.
    const TRAIL = 16;
    for (let k = TRAIL; k >= 1; k--) {
      const [x, y] = bobAt(T.sf - k * 0.028);
      const f = 1 - k / (TRAIL + 1);
      N.glowDot(ctx, ink, x, y, BOB * 0.6 * f, 0.07 + 0.3 * f * f);
    }

    // Pivot, rod and bob.
    const [bx, by] = bobAt(T.sf);
    const [rx, ry] = N.polar(PX, PY, ROD - (BOB - 9), 180 + swing(T.sf));
    N.glow(ctx, ink, 7, (c) => { c.moveTo(PX, PY + 13); c.lineTo(rx, ry); }, { intensity: 0.85 * hum });
    N.glow(ctx, ink, 8, (c) => c.arc(PX, PY, 13, 0, N.TAU), { intensity: 0.9 });
    N.glow(ctx, ink, 13, (c) => c.arc(bx, by, BOB - 11, 0, N.TAU), { intensity: 1 });
    N.glowDot(ctx, ink, bx, by, 24, 1);
    N.glowDot(ctx, ink, bx, by, 12, 1);
  },
});
