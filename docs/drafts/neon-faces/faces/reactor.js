// Reactor: three rings of tube segments around a breathing core. The outer
// ring counts seconds, the middle ring minutes, the thick inner ring hours,
// and the time is also written plainly in the core. Unlit segments stay as
// dark glass so the machine is visible between ticks.
NEON.face({
  id: 'reactor',
  name: 'Reactor',
  hue: 'blue',
  idea: 'An arc reactor: 60 thin segments fill up with the seconds, 60 more with the minutes, 12 thick ones with the hours. The core breathes with HH:MM inside it, and at :00 the seconds ring drains away in 300 ms.',
  draw(ctx, T, N, state) {
    const CX = 500, CY = 500;
    const ink = N.c.blue;
    const breath = 0.9 + 0.1 * Math.sin((T.t / 4) * N.TAU);

    // Segment i of n as an arc of its own slot, with a small gap each side.
    const seg = (c, r, i, n, gapDeg) => {
      const slot = 360 / n;
      const a0 = ((i * slot + gapDeg / 2 - 90) * Math.PI) / 180;
      const a1 = (((i + 1) * slot - gapDeg / 2 - 90) * Math.PI) / 180;
      c.moveTo(CX + r * Math.cos(a0), CY + r * Math.sin(a0));
      c.arc(CX, CY, r, a0, a1);
    };
    const ring = (r, n, gap, width, lit, weights) => {
      // Dark glass: every segment, one batched path.
      ctx.save();
      ctx.lineCap = 'butt';
      ctx.lineWidth = width;
      ctx.strokeStyle = N.rgba(ink, 0.07);
      ctx.beginPath();
      for (let i = 0; i < n; i++) seg(ctx, r, i, n, gap);
      ctx.stroke();
      ctx.restore();
      // Lit segments in brightness tiers: tail, then the head.
      const tiers = new Map();
      for (const [i, k] of lit) {
        const key = Math.round(k * 100) / 100;
        if (!tiers.has(key)) tiers.set(key, []);
        tiers.get(key).push(i);
      }
      for (const [k, list] of tiers) {
        const kk = k * (weights || 1);
        // The lit glass panel, then a hot tube down its middle.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'butt';
        ctx.lineWidth = width;
        ctx.strokeStyle = N.rgba(ink, 0.5 * kk);
        ctx.beginPath();
        for (const i of list) seg(ctx, r, i, n, gap);
        ctx.stroke();
        ctx.restore();
        N.glow(ctx, ink, Math.max(4, width * 0.2), (c) => { for (const i of list) seg(c, r, i, n, gap); }, { intensity: kk, cap: 'butt', halo: k >= 0.99 ? 1 : 0 });
      }
    };
    // Turn "lit 0..head" into [index, intensity] with a bright head and a short tail.
    const trail = (head, n, base) => {
      const out = [];
      for (let i = 0; i <= head && i < n; i++) {
        const behind = head - i;
        out.push([i, behind === 0 ? 1 : behind < 4 ? 0.75 : base]);
      }
      return out;
    };

    // Seconds ring. At :00 it drains from the newest segment back to the start.
    let secLit;
    if (T.s === 0 && T.sf < 0.3) {
      const head = Math.floor(59 * (1 - T.sf / 0.3));
      secLit = trail(head, 60, 0.45).map(([i, k]) => [i, k * (0.35 + 0.65 * (1 - T.sf / 0.3))]);
    } else {
      secLit = trail(T.s, 60, 0.45);
    }
    ring(445, 60, 1.6, 28, secLit);
    ring(383, 60, 1.6, 36, trail(T.m, 60, 0.5));
    const hr = (T.h % 12 || 12) - 1; // 12-hour: noon and midnight light all twelve
    const hourLit = [];
    for (let i = 0; i <= hr; i++) hourLit.push([i, i === hr ? 1 : 0.55]);
    ring(300, 12, 4.5, 56, hourLit, 0.95);

    // Machined rings between the bands, dark glass only.
    ctx.save();
    ctx.strokeStyle = N.rgba(ink, 0.12);
    ctx.lineWidth = 1.5;
    for (const r of [412, 345, 262, 190]) {
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, N.TAU);
      ctx.stroke();
    }
    ctx.restore();

    // Core: a dark disc, its tube rim, and the time inside it.
    const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, 150);
    grad.addColorStop(0, N.rgba(ink, 0.2 * breath));
    grad.addColorStop(0.7, N.rgba(ink, 0.08 * breath));
    grad.addColorStop(1, N.rgba(ink, 0));
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(CX, CY, 150, 0, N.TAU);
    ctx.fill();
    ctx.restore();
    N.glow(ctx, ink, 8, (c) => c.arc(CX, CY, 134, 0, N.TAU), { intensity: 0.9 * breath });
    N.glow(ctx, ink, 4, (c) => c.arc(CX, CY, 150, 0, N.TAU), { intensity: 0.25 * breath, halo: 0.5 });

    // HH:MM, four seven-segment digits and a colon, 100 tall.
    const dw = 40, dh = 100, gap = 14, colW = 22;
    const total = 4 * dw + 3 * gap + colW;
    const y = CY - dh / 2;
    const str = T.hh + T.mm;
    const timeIntensity = 0.92 + 0.08 * breath;
    const lead = str[0] === '1' ? dw : 0; // a leading 1 hugs the right of its box
    const x00 = CX - total / 2 - lead / 2;
    N.glow(ctx, ink, 8, (c) => {
      let x = x00;
      for (let i = 0; i < 4; i++) {
        N.seg7(c, str[i], x, y, dw, dh, { gap: 4 });
        x += dw + gap;
        if (i === 1) x += colW; // the colon slot
      }
    }, { intensity: timeIntensity });
    const colX = x00 + 2 * dw + gap + colW / 2;
    const colOn = T.sf % 1 < 0.5 ? 1 : 0.35;
    N.glowDot(ctx, ink, colX, CY - 20, 5, colOn);
    N.glowDot(ctx, ink, colX, CY + 20, 5, colOn);
  },
});
