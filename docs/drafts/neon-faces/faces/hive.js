// Hive: a honeycomb filling the disc, every cell outlined dim. The minutes are
// an arc of cells that fills clockwise with the minute hand, the cell under
// the hand pulsing; the time itself is big lime segment digits in the empty middle.
NEON.face({
  id: 'hive',
  name: 'Hive',
  hue: 'lime',
  idea: 'A flat-top honeycomb. Cells in a band round the middle light as the minute hand passes, a hex-pixel arc filling clockwise through the hour, the cell under the hand pulsing. HH:MM sits in the hollow centre in lime segment tube.',
  draw(ctx, T, N, state) {
    const CX = 500, CY = 500;
    const ink = N.c.lime;
    const S = 46;                         // hex circumradius
    const DX = S * 1.5, DY = S * Math.sqrt(3);
    const hum = 0.95 + 0.05 * N.noise(T.t * 1.6);

    if (!state.ready) {
      // Flat-top lattice: columns DX apart, odd columns drop half a cell.
      const corner = (cx, cy, i, k) => {
        const a = (Math.PI / 3) * i;
        const rr = S * (k || 1);
        return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
      };
      state.corner = corner;
      state.cells = [];
      for (let col = -13; col <= 13; col++) {
        for (let row = -9; row <= 9; row++) {
          const x = CX + col * DX;
          const y = CY + row * DY + (col & 1 ? DY / 2 : 0);
          const r = Math.hypot(x - CX, y - CY);
          if (r > 535) continue;
          state.cells.push({ x, y, r, ang: ((Math.atan2(y - CY, x - CX) * 180) / Math.PI + 90 + 360) % 360 });
        }
      }
      // The minute arc: cells with centre in the band r 300 to 450.
      state.band = state.cells.filter((c) => c.r >= 300 && c.r <= 450);
      state.ready = true;
    }
    const hex = (c, cell) => {
      const k = cell.s || 1;
      const [x0, y0] = state.corner(cell.x, cell.y, 0, k);
      c.moveTo(x0, y0);
      for (let i = 1; i < 6; i++) {
        const [x, y] = state.corner(cell.x, cell.y, i, k);
        c.lineTo(x, y);
      }
      c.closePath();
    };

    // The whole lattice, dim, in two batched paths: cells inside r 230 almost
    // vanish so they do not fight the digits. Three consecutive edges per cell
    // cover every shared edge exactly once.
    const lattice = (near, alpha) => {
      ctx.save();
      ctx.strokeStyle = N.rgba(ink, alpha);
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (const cell of state.cells) {
        if ((cell.r < 230) !== near) continue;
        const [x0, y0] = state.corner(cell.x, cell.y, 0);
        ctx.moveTo(x0, y0);
        for (let i = 1; i <= 3; i++) {
          const [x, y] = state.corner(cell.x, cell.y, i);
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    };
    lattice(false, 0.11);
    lattice(true, 0.025);

    // Minute arc: every band cell whose angle is under the minute hand is lit,
    // so the hex-pixelated arc fills clockwise through the hour. The cell the
    // hand is in pulses.
    const ang = T.minuteDeg;
    const on = state.band.filter((c) => c.ang < ang);
    const off = state.band.filter((c) => c.ang >= ang);
    let head = null;
    for (const c of on) if (!head || c.ang > head.ang) head = c;
    ctx.save();
    ctx.strokeStyle = N.rgba(ink, 0.2);
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const cell of off) hex(ctx, cell);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = N.rgba(ink, 0.15);
    ctx.beginPath();
    for (const cell of on) if (cell !== head) hex(ctx, cell);
    ctx.fill();
    ctx.restore();
    N.glow(ctx, ink, 4, (c) => { for (const cell of on) if (cell !== head) hex(c, cell); }, { intensity: 0.9 * hum, halo: 0 });
    if (head) {
      const pulse = 0.72 + 0.28 * Math.sin(T.t * 5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = N.rgba(ink, 0.15 + 0.15 * pulse);
      ctx.beginPath();
      hex(ctx, head);
      ctx.fill();
      ctx.restore();
      N.glow(ctx, ink, 6, (c) => hex(c, head), { intensity: pulse });
      N.glowDot(ctx, ink, head.x, head.y, 9, 0.5 * pulse);
    }

    // HH:MM in the hollow middle: 92 x 200 digits, tube-thick segments.
    const W = 92, H = 200, G = 18, COL = 32;
    const total = 4 * W + 2 * G + COL + 2 * 22;
    let x = CX - total / 2;
    const y = CY - H / 2;
    const place = [];
    place.push([T.hh[0], x]); x += W + G;
    place.push([T.hh[1], x]); x += W + 22;
    const colonX = x + COL / 2; x += COL + 22;
    place.push([T.mm[0], x]); x += W + G;
    place.push([T.mm[1], x]);
    // Unlit segments, then lit.
    ctx.save();
    ctx.strokeStyle = N.rgba(ink, 0.07);
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [d, px] of place) N.seg7(ctx, d, px, y, W, H, { off: true, gap: 10 });
    ctx.stroke();
    ctx.restore();
    N.glow(ctx, ink, 11, (c) => {
      for (const [d, px] of place) N.seg7(c, d, px, y, W, H, { gap: 8 });
    }, { intensity: hum });
    // Colon: two dots that breathe once a second.
    const b = 0.65 + 0.35 * Math.cos(T.sf * Math.PI * 2);
    N.glowDot(ctx, ink, colonX, y + H * 0.3, 8, b * hum);
    N.glowDot(ctx, ink, colonX, y + H * 0.7, 8, b * hum);
  },
});
