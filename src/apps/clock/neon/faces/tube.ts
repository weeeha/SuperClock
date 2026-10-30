import type { NeonFace } from '../neon';

// Tube: hands and hour marks bent from cyan glass tube, one magenta spark for
// the seconds. Ported from docs/drafts/neon-faces/faces/tube.js, and the
// reference for every other neon face: the dial is a cached layer (it never
// changes), only the hands and the spark draw live.

const CX = 500;
const CY = 500;

const face: NeonFace = {
  id: 'neon-tube',
  draw(ctx, T, N, state) {
    const ink = N.c.cyan;
    // A real tube hums: a slow, barely visible flicker, the same every night.
    const hum = 0.94 + 0.06 * N.noise(T.t * 1.7);

    N.layer(ctx, state, 'dial', 'static', (l) => {
      // The dark glass of the unlit return tube, so the dial reads as a built
      // object even where nothing glows.
      l.strokeStyle = N.rgba(ink, 0.07);
      l.lineWidth = 3;
      l.beginPath();
      l.arc(CX, CY, 462, 0, N.TAU);
      l.stroke();
      // Twelve hour marks; the cardinals are longer.
      N.glow(l, ink, 10, (c) => {
        for (let i = 0; i < 12; i++) {
          const deg = i * 30;
          const [x1, y1] = N.polar(CX, CY, i % 3 === 0 ? 360 : 400, deg);
          const [x2, y2] = N.polar(CX, CY, 440, deg);
          c.moveTo(x1, y1);
          c.lineTo(x2, y2);
        }
      }, { intensity: 0.55 });
    });

    const hand = (deg: number, len: number, w: number) =>
      N.glow(ctx, ink, w, (c) => {
        const [tx, ty] = N.polar(CX, CY, -36, deg);
        const [x1, y1] = N.polar(CX, CY, len, deg);
        c.moveTo(tx, ty);
        c.lineTo(x1, y1);
      }, { intensity: hum });
    hand(T.hourDeg, 250, 26);
    hand(T.minuteDeg, 375, 17);

    // Hub: the ring the hands are mounted on.
    N.glow(ctx, ink, 6, (c) => c.arc(CX, CY, 20, 0, N.TAU), { intensity: 0.8 * hum });

    // Seconds: a magenta spark sweeping the outer track with a short comet tail.
    const tail = 10;
    for (let i = tail; i >= 1; i--) {
      const [x, y] = N.polar(CX, CY, 462, T.sweepDeg - i * 1.2);
      N.glowDot(ctx, N.c.magenta, x, y, 6, (0.06 * (tail - i + 1)) / tail);
    }
    const [sx, sy] = N.polar(CX, CY, 462, T.sweepDeg);
    N.glowDot(ctx, N.c.magenta, sx, sy, 11, 1);
  },
};

export default face;
