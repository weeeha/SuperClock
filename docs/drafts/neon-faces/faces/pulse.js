// Pulse: a heart monitor. HH:MM glows in seven-segment tube above; below it a
// green trace scrolls left from the write head, one P-QRS-T beat per second
// with the spike landing exactly on each second. The trace fades with age.
NEON.face({
  id: 'pulse',
  name: 'Pulse',
  hue: 'green',
  idea: 'A heart monitor. The trace scrolls left from a bright write head and spikes exactly on every second; HH:MM stands above it in green tube digits and the colon flashes with each beat.',
  draw(ctx, T, N, state) {
    const ink = N.c.green;
    const BASE = 685, HEAD = 760, LEFT = 60;
    const SPEED = 172;                     // units per second: 4 s of trace
    const WINDOW = (HEAD - LEFT) / SPEED;

    // One beat in beat time u (-0.5..0.5, spike at 0) and height v (up is +).
    const BEAT = [
      [-0.5, 0], [-0.31, 0], [-0.27, 9], [-0.23, 15], [-0.19, 9], [-0.15, 0],
      [-0.07, 0], [-0.04, -16], [0, 120], [0.035, -44], [0.06, 0],
      [0.13, 0], [0.19, 16], [0.27, 32], [0.35, 16], [0.41, 0], [0.5, 0],
    ];

    // Faint graph paper behind the trace, one batched path.
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = N.rgba(ink, 0.05);
    ctx.beginPath();
    for (let x = 20; x <= 980; x += 20) { ctx.moveTo(x, 520); ctx.lineTo(x, 850); }
    for (let y = 520; y <= 850; y += 20) { ctx.moveTo(20, y); ctx.lineTo(980, y); }
    ctx.stroke();
    ctx.strokeStyle = N.rgba(ink, 0.08);
    ctx.beginPath();
    for (let x = 60; x <= 960; x += 100) { ctx.moveTo(x, 520); ctx.lineTo(x, 850); }
    for (let y = 520; y <= 850; y += 100) { ctx.moveTo(20, y); ctx.lineTo(980, y); }
    ctx.stroke();
    ctx.restore();

    // Build the visible trace oldest to newest as flat [x, y, x, y ...].
    // Beat j has its spike j + frac seconds ago; frac is continuous across
    // the minute wrap because only the fraction of a second is used.
    const frac = T.sf - Math.floor(T.sf);
    const pts = [];
    for (let j = Math.ceil(WINDOW) + 1; j >= -1; j--) {
      for (const [u, v] of BEAT) {
        const age = frac + j - u;
        pts.push(HEAD - age * SPEED, BASE - v);
      }
    }
    // Keep only x in [x0, x1], interpolating where the line crosses the edges.
    const clipX = (x0, x1) => {
      const out = [];
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3];
        if (bx < x0 || ax > x1) continue;
        const ta = ax < x0 ? (x0 - ax) / (bx - ax) : 0;
        const tb = bx > x1 ? (x1 - ax) / (bx - ax) : 1;
        if (!out.length) out.push(ax + (bx - ax) * ta, ay + (by - ay) * ta);
        out.push(ax + (bx - ax) * tb, ay + (by - ay) * tb);
      }
      return out;
    };
    const poly = (c, p) => {
      if (p.length < 4) return;
      c.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
    };

    // Four bands, dimmer with age; the newest carries the full glow.
    const bands = 4;
    const bw = (HEAD - LEFT) / bands;
    const fade = [0.1, 0.26, 0.55, 1];
    let headY = BASE;
    for (let b = 0; b < bands; b++) {
      const p = clipX(LEFT + b * bw, LEFT + (b + 1) * bw);
      N.glow(ctx, ink, 7, (c) => poly(c, p), { intensity: fade[b], halo: b === bands - 1 ? 1 : 0.6 });
      if (b === bands - 1 && p.length) headY = p[p.length - 1];
    }
    // The write head, and the gap in front of it where the beam has not yet drawn.
    N.glowDot(ctx, ink, HEAD, headY, 10, 1);

    // HH:MM in seven-segment tube, 180 tall. The colon flashes on each beat.
    const beat = Math.exp(-frac * 7);
    const dw = 96, dh = 180, gap = 30, colW = 42;
    const total = 4 * dw + 3 * gap + colW;
    const y0 = 255;
    const str = T.hh + T.mm;
    // A leading 1 sits against the right of its box: pull the whole line left to stay centred.
    const lead = str[0] === '1' ? dw : 0;
    const x00 = 500 - total / 2 - lead / 2;
    N.glow(ctx, ink, 11, (c) => {
      let x = x00;
      for (let i = 0; i < 4; i++) {
        N.seg7(c, str[i], x, y0, dw, dh, { gap: 8 });
        x += dw + gap;
        if (i === 1) x += colW;
      }
    }, { intensity: 0.9 + 0.1 * beat });
    const colX = x00 + 2 * dw + gap + colW / 2;
    N.glowDot(ctx, ink, colX, y0 + dh * 0.3, 8, 0.5 + 0.5 * beat);
    N.glowDot(ctx, ink, colX, y0 + dh * 0.7, 8, 0.5 + 0.5 * beat);
  },
});
