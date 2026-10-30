// Outline: giant hollow numerals, HH over MM, bent from yellow tube. Each
// glow pass re-strokes the text at its own width, so the letter edge itself
// burns like a sign-maker's channel letter. A yellow spark runs the rim.
NEON.face({
  id: 'outline',
  name: 'Outline',
  hue: 'yellow',
  idea: 'Four giant hollow numerals, HH above MM, glowing along their edges like channel-letter tube. Each digit cross-fades when it changes; a spark runs the rim for the seconds.',
  draw(ctx, T, N, state) {
    const CX = 500, CY = 500;
    const ink = N.c.yellow;
    const SIZE = 410;
    const CAP = SIZE * 0.72;
    const hum = 0.95 + 0.05 * N.noise(T.t * 1.3);

    // Per-digit change tracking, so a changed digit cross-fades alone.
    if (!state.ready) {
      state.cur = ['', '', '', ''];
      state.prev = ['', '', '', ''];
      state.at = [-99, -99, -99, -99];
      state.ready = true;
    }
    const now = (T.hh + T.mm).split('');
    for (let i = 0; i < 4; i++) {
      if (now[i] !== state.cur[i]) {
        state.prev[i] = state.cur[i];
        state.cur[i] = now[i];
        state.at[i] = state.prev[i] === '' ? -99 : T.t;
      }
    }

    ctx.font = `900 ${SIZE}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Slot centres: two columns, two rows.
    const xs = [500 - 150, 500 + 150];
    const ys = [CY - 168 + CAP / 2, CY + 168 + CAP / 2];
    const slot = (i) => [xs[i % 2], ys[i >> 1]];

    // Dark glass inside the letters, so they read as objects even unlit.
    ctx.save();
    ctx.fillStyle = N.rgba(ink, 0.045);
    for (let i = 0; i < 4; i++) {
      const [x, y] = slot(i);
      ctx.fillText(state.cur[i], x, y);
    }
    ctx.restore();

    for (let i = 0; i < 4; i++) {
      const [x, y] = slot(i);
      const k = N.ease((T.t - state.at[i]) / 0.3);
      if (k < 1 && state.prev[i] !== '') {
        N.glow(ctx, ink, 9, (c) => c.strokeText(state.prev[i], x, y), { intensity: (1 - k) * hum });
      }
      // A wider, fainter pass: the room-filling bloom around the tube.
      N.glow(ctx, ink, 18, (c) => c.strokeText(state.cur[i], x, y), { intensity: 0.22 * hum * (k < 1 && state.prev[i] !== '' ? k : 1), core: false });
      N.glow(ctx, ink, 9, (c) => c.strokeText(state.cur[i], x, y), { intensity: (k < 1 && state.prev[i] !== '' ? k : 1) * hum });
    }

    // Unlit rim track the spark runs on.
    ctx.save();
    ctx.strokeStyle = N.rgba(ink, 0.07);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CX, CY, 482, 0, N.TAU);
    ctx.stroke();
    ctx.restore();

    // Seconds: a spark on the rim with a short comet tail.
    const tail = 10;
    for (let i = tail; i >= 1; i--) {
      const [tx, ty] = N.polar(CX, CY, 482, T.sweepDeg - i * 1.1);
      N.glowDot(ctx, ink, tx, ty, 5, 0.07 * (tail - i + 1) / tail);
    }
    const [sx, sy] = N.polar(CX, CY, 482, T.sweepDeg);
    N.glowDot(ctx, ink, sx, sy, 10, 1);
  },
});
