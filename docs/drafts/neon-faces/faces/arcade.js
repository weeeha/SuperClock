// Arcade: a cyan maze corridor round the rim, sixty yellow pellets in it, and
// a diamond spark that eats them clockwise once a minute. The time sits in the
// middle in a chunky 5 by 7 pixel font, every font pixel a lit square.
NEON.face({
  id: 'arcade',
  name: 'Arcade',
  hue: 'cyan',
  accent: 'yellow',
  accentFor: 'the seconds',
  idea: 'A cyan double-walled corridor with sixty yellow pellets. A diamond spark with a tail eats them clockwise, one per second, and they all respawn with a flash at :00. HH:MM in glowing pixel squares.',
  draw(ctx, T, N, state) {
    const CX = 500, CY = 500;
    const ink = N.c.cyan, gold = N.c.yellow;
    const hum = 0.95 + 0.05 * N.noise(T.t * 1.9);

    if (!state.ready) {
      // 5 x 7 pixel font, one string per row.
      const F = {
        0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
        1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
        2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
        3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
        4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
        5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
        6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
        7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
        8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
        9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
      };
      state.font = {};
      for (const k in F) {
        const cells = [];
        F[k].forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') cells.push([x, y]); }));
        state.font[k] = cells;
      }
      state.ready = true;
    }

    // Maze walls: inner and outer wall rings plus stubs that poke into the
    // corridor between pellets. The collector's path stays clear.
    const stubs = [];
    for (let i = 0; i < 10; i++) {
      const deg = i * 36 + 3 + (i % 2) * 0;
      stubs.push([deg, i % 2 === 0]);
    }
    N.glow(ctx, ink, 5, (c) => {
      c.arc(CX, CY, 405, 0, N.TAU);
      c.moveTo(CX + 470, CY);
      c.arc(CX, CY, 470, 0, N.TAU);
    }, { intensity: 0.34 * hum });
    N.glow(ctx, ink, 5, (c) => {
      for (const [deg, fromOuter] of stubs) {
        const [x1, y1] = N.polar(CX, CY, fromOuter ? 470 : 405, deg);
        const [x2, y2] = N.polar(CX, CY, fromOuter ? 452 : 423, deg);
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
      }
    }, { intensity: 0.3 * hum });

    // Pellets: 60, one per second of the minute. Those the collector has
    // passed are gone; the one it is about to eat swells; at :00 all flash.
    const sweep = T.sweepDeg;
    const flash = N.clamp(1 - T.sf / 0.8, 0, 1);
    for (let i = 0; i < 60; i++) {
      const deg = i * 6;
      if (deg <= sweep - 3) continue;
      const near = N.clamp(1 - (deg - sweep) / 18, 0, 1);
      const [x, y] = N.polar(CX, CY, 437, deg);
      N.glowDot(ctx, gold, x, y, 4.4 + near * 1.6 + flash * 1.8, 1);
    }
    if (flash > 0) {
      N.glow(ctx, gold, 5, (c) => c.arc(CX, CY, 437, 0, N.TAU), { intensity: flash * 0.7, core: false });
    }

    // Collector: a diamond spark with a tail of fading embers behind it.
    for (let i = 14; i >= 1; i--) {
      const d = i * 1.0;
      const [x, y] = N.polar(CX, CY, 437, sweep - d);
      N.glowDot(ctx, gold, x, y, 2.5 + (14 - i) * 0.25, 0.5 * (14 - i + 1) / 14);
    }
    const [hx, hy] = N.polar(CX, CY, 437, sweep);
    const ux = Math.cos(((sweep) * Math.PI) / 180), uy = Math.sin(((sweep) * Math.PI) / 180);
    // tangent (direction of travel) = (cos a, sin a) with a = sweep in screen terms
    const tx = ux, ty = uy;
    const nx = -uy, ny = ux;
    const L = 17, Wd = 10;
    N.glow(ctx, gold, 7, (c) => {
      c.moveTo(hx + tx * L, hy + ty * L);
      c.lineTo(hx + nx * Wd, hy + ny * Wd);
      c.lineTo(hx - tx * L, hy - ty * L);
      c.lineTo(hx - nx * Wd, hy - ny * Wd);
      c.closePath();
    }, { intensity: 1 });
    N.glowDot(ctx, gold, hx, hy, 6, 0.9);

    // The time: glowing pixel squares. Six columns of 5-wide digits plus a
    // narrow colon: 5 + 1 + 5, 5-wide gap for the colon, 5 + 1 + 5.
    const P = 26, S = 23;
    const gridW = 27 * P;
    const x0 = CX - gridW / 2, y0 = CY - (7 * P) / 2;
    const col = [0, 6, 16, 22];
    // x0 below centres the 27-column grid; the colon sits in column 13.
    const digits = (T.hh + T.mm).split('');
    const lit = [];
    digits.forEach((d, i) => {
      for (const [px, py] of state.font[d]) lit.push([x0 + (col[i] + px) * P, y0 + py * P]);
    });
    // Colon, two pixels, breathing once a second.
    const colon = [[x0 + 13 * P, y0 + 2 * P], [x0 + 13 * P, y0 + 4 * P]];
    const breathe = 0.7 + 0.3 * Math.cos(T.sf * Math.PI * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Dark pixel sockets behind everything, so the matrix reads when unlit.
    ctx.fillStyle = N.rgba(ink, 0.05);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) for (let px = 0; px < 5; px++) for (let py = 0; py < 7; py++) {
      ctx.rect(x0 + (col[i] + px) * P + (P - S) / 2, y0 + py * P + (P - S) / 2, S, S);
    }
    ctx.fill();
    const paint = (list, k) => {
      for (const [x, y] of list) {
        ctx.fillStyle = N.rgba(ink, 0.9 * k);
        ctx.fillRect(x + (P - S) / 2, y + (P - S) / 2, S, S);
        ctx.fillStyle = N.rgba(N.core(ink), 0.9 * k);
        ctx.fillRect(x + (P - S) / 2 + 5, y + (P - S) / 2 + 5, S - 10, S - 10);
      }
    };
    paint(lit, hum);
    paint(colon, breathe * hum);
    ctx.restore();
    // Bloom: one soft dot per pixel, below the squares.
    for (const [x, y] of lit) N.glowDot(ctx, ink, x + P / 2, y + P / 2, 7, 0.4 * hum);
    for (const [x, y] of colon) N.glowDot(ctx, ink, x + P / 2, y + P / 2, 7, 0.4 * breathe);
  },
});
