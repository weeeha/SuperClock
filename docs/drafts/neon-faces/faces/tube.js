// Tube: the reference face. Hands and hour marks bent from cyan glass tube,
// one magenta spark for the seconds. Read this before drafting another face:
// it shows the contract (1000-unit space, time only from T, glow only through
// N.glow / N.glowDot, persistent bits in `state`).
NEON.face({
  id: 'tube',
  name: 'Tube',
  hue: 'cyan',
  accent: 'magenta',
  accentFor: 'the seconds',
  idea: 'Hands and hour marks bent from cyan glass tube, like a sign maker built a clock. One magenta spark runs the rim for the seconds.',
  draw(ctx, T, N, state) {
    const CX = 500, CY = 500;
    const ink = N.c.cyan;

    // A real tube hums: a slow, barely visible flicker, the same every night.
    const hum = 0.94 + 0.06 * N.noise(T.t * 1.7);

    // The dark glass of the unlit return tube behind the marks, so the dial
    // reads as a built object even where nothing glows.
    ctx.save();
    ctx.strokeStyle = N.rgba(ink, 0.07);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CX, CY, 462, 0, N.TAU);
    ctx.stroke();
    ctx.restore();

    // Twelve hour marks; the cardinals are longer.
    N.glow(ctx, ink, 10, (c) => {
      for (let i = 0; i < 12; i++) {
        const deg = i * 30;
        const inner = i % 3 === 0 ? 360 : 400;
        const [x1, y1] = N.polar(CX, CY, inner, deg);
        const [x2, y2] = N.polar(CX, CY, 440, deg);
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
      }
    }, { intensity: 0.55 * hum });

    // Hands: a straight tube from just behind the hub to the tip.
    const hand = (deg, len, w, k) =>
      N.glow(ctx, ink, w, (c) => {
        const [tx, ty] = N.polar(CX, CY, -36, deg);
        const [x1, y1] = N.polar(CX, CY, len, deg);
        c.moveTo(tx, ty);
        c.lineTo(x1, y1);
      }, { intensity: k * hum });
    hand(T.hourDeg, 250, 26, 1);
    hand(T.minuteDeg, 375, 17, 1);

    // Hub: a small ring the hands are mounted on.
    N.glow(ctx, ink, 6, (c) => c.arc(CX, CY, 20, 0, N.TAU), { intensity: 0.8 * hum });

    // Seconds: a magenta spark sweeping the outer track, with a short comet
    // tail so the motion reads at a glance.
    const tail = 10;
    for (let i = tail; i >= 1; i--) {
      const [x, y] = N.polar(CX, CY, 462, T.sweepDeg - i * 1.2);
      N.glowDot(ctx, N.c.magenta, x, y, 6, 0.06 * (tail - i + 1) / tail);
    }
    const [sx, sy] = N.polar(CX, CY, 462, T.sweepDeg);
    N.glowDot(ctx, N.c.magenta, sx, sy, 11, 1);
  },
});
