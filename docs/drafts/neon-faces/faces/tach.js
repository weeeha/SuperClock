// Tach: a 270-degree red tachometer open at the bottom. The scale is the
// minutes 0 to 60 and the needle is the minute, moving smoothly with the
// seconds; 55 to 60 is the redline. The hour sits below the hub as a big
// gear-indicator digit pair, with a thin shift-light bar filling with the
// seconds. One hue; hierarchy by brightness only.
NEON.face({
  id: 'tach',
  name: 'Tach',
  hue: 'red',
  idea: 'A tachometer with the minutes on its scale and a needle that is the minute hand, redline at 55 to 60. The hour is the gear indicator below the hub; a shift-light bar fills with the seconds.',
  draw(ctx, T, N, state) {
    const ink = N.c.red;
    const CX = 500, CY = 452;
    const hum = 0.95 + 0.05 * N.noise(T.t * 2.3);

    // Minute value (0 to 60) to dial angle: 0 at -135 deg, 60 at +135 deg.
    const ang = (v) => -135 + (v / 60) * 270;
    const rad = (deg) => ((deg - 90) * Math.PI) / 180;
    const minuteVal = T.minuteDeg / 6;

    // Unlit track: the dark glass of the full scale arc.
    ctx.save();
    ctx.strokeStyle = N.rgba(ink, 0.08);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(CX, CY, 412, rad(-135), rad(135));
    ctx.stroke();
    ctx.restore();

    // Minor ticks (every minute, dim) and majors (every 5).
    N.glow(ctx, ink, 3, (c) => {
      for (let v = 0; v <= 60; v++) {
        if (v % 5 === 0 || v >= 55) continue;
        const [x1, y1] = N.polar(CX, CY, 392, ang(v));
        const [x2, y2] = N.polar(CX, CY, 412, ang(v));
        c.moveTo(x1, y1); c.lineTo(x2, y2);
      }
    }, { intensity: 0.28, halo: 0.5 });
    N.glow(ctx, ink, 6, (c) => {
      for (let v = 0; v <= 55; v += 5) {
        const [x1, y1] = N.polar(CX, CY, 376, ang(v));
        const [x2, y2] = N.polar(CX, CY, 414, ang(v));
        c.moveTo(x1, y1); c.lineTo(x2, y2);
      }
    }, { intensity: 0.5 * hum });

    // Redline: a heavier arc from 55 to 60 with its own ticks.
    N.glow(ctx, ink, 11, (c) => c.arc(CX, CY, 428, rad(ang(55)), rad(ang(60))), { intensity: 0.85 * hum });
    N.glow(ctx, ink, 5, (c) => {
      for (let v = 55; v <= 60; v++) {
        const [x1, y1] = N.polar(CX, CY, 380, ang(v));
        const [x2, y2] = N.polar(CX, CY, 412, ang(v));
        c.moveTo(x1, y1); c.lineTo(x2, y2);
      }
    }, { intensity: 0.7 });

    // Scale numerals 0..60 by tens, in thin seven-segment strokes upright at
    // their dial position.
    const nh = 38, nw = 20;
    N.glow(ctx, ink, 3.5, (c) => {
      for (let v = 0; v <= 60; v += 10) {
        const txt = String(v);
        const [px, py] = N.polar(CX, CY, 335, ang(v));
        const total = txt.length * nw + (txt.length - 1) * 8;
        for (let i = 0; i < txt.length; i++) {
          N.seg7(c, txt[i], px - total / 2 + i * (nw + 8), py - nh / 2, nw, nh);
        }
      }
    }, { intensity: 0.75, halo: 0 });

    // Needle: tapered by two strokes, a long thin one over a short heavy one,
    // with a counterweight tail behind the hub.
    const [nx, ny] = N.polar(CX, CY, 396, minuteVal === 0 ? 0 : ang(minuteVal));
    const [tx, ty] = N.polar(CX, CY, -52, ang(minuteVal));
    const [mx, my] = N.polar(CX, CY, 220, ang(minuteVal));
    N.glow(ctx, ink, 12, (c) => { c.moveTo(tx, ty); c.lineTo(nx, ny); }, { intensity: 1 });
    N.glow(ctx, ink, 20, (c) => { c.moveTo(tx, ty); c.lineTo(mx, my); }, { intensity: 1 });
    // Hub.
    N.glow(ctx, ink, 8, (c) => c.arc(CX, CY, 24, 0, N.TAU), { intensity: 0.9 });
    N.glowDot(ctx, ink, CX, CY, 8, 0.8);

    // The hour: gear-indicator digits, big and bright, below the hub.
    const DW = 100, DH = 230, DG = 40, dy = 600;
    // A "1" is lit only on its right edge, so centre the lit ink, not the cell.
    const cell = (ch) => (ch === '1' ? [DW, DW] : [0, DW]);
    const [a0, a1] = cell(T.hh[0]), [b0, b1] = cell(T.hh[1]);
    const inkW = (DW + DG + b1) - a0;
    const hx = 500 - inkW / 2 - a0;
    N.glow(ctx, ink, 20, (c) => {
      N.seg7(c, T.hh[0], hx, dy, DW, DH, { gap: 12 });
      N.seg7(c, T.hh[1], hx + DW + DG, dy, DW, DH, { gap: 12 });
    }, { intensity: 1 * hum });
    // Unlit segments, so the digit reads as lit tube in a dark housing.
    N.glow(ctx, ink, 20, (c) => {
      N.seg7(c, T.hh[0], hx, dy, DW, DH, { gap: 12, off: true });
      N.seg7(c, T.hh[1], hx + DW + DG, dy, DW, DH, { gap: 12, off: true });
    }, { intensity: 0.05, halo: 0, core: false });

    // Shift-light bar: a thin track that fills with the seconds.
    const bx0 = 500 - 150, bw = 300, by = 874;
    ctx.save();
    ctx.strokeStyle = N.rgba(ink, 0.1);
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx0, by); ctx.lineTo(bx0 + bw, by);
    ctx.stroke();
    ctx.restore();
    const fill = (T.sf / 60) * bw;
    if (fill > 1) {
      N.glow(ctx, ink, 8, (c) => { c.moveTo(bx0, by); c.lineTo(bx0 + fill, by); }, { intensity: 0.75 });
      N.glowDot(ctx, ink, bx0 + fill, by, 7, 0.9);
    }
  },
});
