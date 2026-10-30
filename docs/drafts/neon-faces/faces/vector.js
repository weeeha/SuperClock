// Vector: an oscilloscope-style vector display. HH:MM is a string of beam
// strokes in a simple vector font; the beam re-traces the whole string twice a
// second, leaving the full path at a steady mid level and the stretch just
// behind the beam head brighter. A small Lissajous figure sits below, its
// frequency ratio taken from the hour and minute and its phase turning with
// the seconds. Gallery `persist` supplies the phosphor afterglow.
NEON.face({
  id: 'vector',
  name: 'Vector',
  hue: 'lime',
  idea: 'A vector display: HH:MM as beam strokes the beam re-traces twice a second, the stretch behind the beam head burning brighter. A Lissajous figure below turns with the seconds.',
  persist: 0.15,
  draw(ctx, T, N, state) {
    const ink = N.c.lime;

    // One polyline per glyph in a unit box (y down). The colon is two ticks.
    if (!state.ready) {
      state.font = {
        0: [[0, 0.12], [0.12, 0], [0.88, 0], [1, 0.12], [1, 0.88], [0.88, 1], [0.12, 1], [0, 0.88], [0, 0.12]],
        1: [[0.15, 0.2], [0.55, 0], [0.55, 1]],
        2: [[0, 0.15], [0.15, 0], [0.85, 0], [1, 0.15], [1, 0.4], [0, 1], [1, 1]],
        3: [[0, 0], [1, 0], [0.45, 0.45], [0.85, 0.45], [1, 0.6], [1, 0.85], [0.85, 1], [0.15, 1], [0, 0.85]],
        4: [[0.75, 1], [0.75, 0], [0, 0.7], [1, 0.7]],
        5: [[1, 0], [0, 0], [0, 0.45], [0.8, 0.45], [1, 0.6], [1, 0.85], [0.85, 1], [0.15, 1], [0, 0.85]],
        6: [[0.9, 0], [0.2, 0], [0, 0.2], [0, 0.85], [0.15, 1], [0.85, 1], [1, 0.85], [1, 0.6], [0.85, 0.45], [0, 0.45]],
        7: [[0, 0], [1, 0], [0.35, 1]],
        8: [[0.5, 0.5], [0.05, 0.3], [0.05, 0.1], [0.15, 0], [0.85, 0], [0.95, 0.1], [0.95, 0.3], [0.5, 0.5],
            [0.05, 0.7], [0.05, 0.9], [0.15, 1], [0.85, 1], [0.95, 0.9], [0.95, 0.7], [0.5, 0.5]],
        9: [[1, 0.55], [0.15, 0.55], [0, 0.4], [0, 0.15], [0.15, 0], [0.85, 0], [1, 0.15], [1, 0.85], [0.8, 1], [0.1, 1]],
      };
      state.ready = true;
    }

    // Lay the string out as polylines in disc units, with cumulative lengths.
    const DW = 100, DH = 190, GAP = 36, COL = 64;
    const x0 = 500 - (4 * DW + 2 * GAP + COL) / 2, y0 = 345;
    const xs = [x0, x0 + DW + GAP, x0 + 2 * DW + GAP + COL, x0 + 3 * DW + 2 * GAP + COL];
    const chars = T.hh + T.mm;
    const lines = [];
    let total = 0;
    const addLine = (pts) => {
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lines.push({ pts, start: total, len });
      total += len;
    };
    for (let i = 0; i < 4; i++) {
      addLine(state.font[chars[i]].map(([u, v]) => [xs[i] + u * DW, y0 + v * DH]));
      if (i === 1) {
        const cx = x0 + 2 * DW + GAP + COL / 2;
        addLine([[cx, y0 + DH * 0.27], [cx, y0 + DH * 0.37]]);
        addLine([[cx, y0 + DH * 0.63], [cx, y0 + DH * 0.73]]);
      }
    }

    // Faint graticule: a square grid with finer ticks along the centre axes.
    ctx.save();
    ctx.strokeStyle = N.rgba(ink, 0.05);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let g = 100; g < 1000; g += 100) {
      ctx.moveTo(g, 20); ctx.lineTo(g, 980);
      ctx.moveTo(20, g); ctx.lineTo(980, g);
    }
    ctx.stroke();
    ctx.strokeStyle = N.rgba(ink, 0.11);
    ctx.beginPath();
    ctx.moveTo(20, 500); ctx.lineTo(980, 500);
    ctx.moveTo(500, 20); ctx.lineTo(500, 980);
    for (let g = 20; g <= 980; g += 40) {
      ctx.moveTo(g, 494); ctx.lineTo(g, 506);
      ctx.moveTo(494, g); ctx.lineTo(506, g);
    }
    ctx.stroke();
    ctx.restore();

    // The beam: the whole string at a steady level, then the stretch behind
    // the head. extract() adds the part of the string between lengths a and b.
    const pathAll = (c) => {
      for (const l of lines) {
        c.moveTo(l.pts[0][0], l.pts[0][1]);
        for (let i = 1; i < l.pts.length; i++) c.lineTo(l.pts[i][0], l.pts[i][1]);
      }
    };
    const extract = (c, a, b) => {
      for (const l of lines) {
        if (l.start + l.len < a || l.start > b) continue;
        let acc = l.start, open = false;
        for (let i = 1; i < l.pts.length; i++) {
          const p = l.pts[i - 1], q = l.pts[i];
          const seg = Math.hypot(q[0] - p[0], q[1] - p[1]);
          const s0 = acc, s1 = acc + seg;
          acc = s1;
          if (s1 < a || s0 > b || seg === 0) continue;
          const t0 = Math.max(0, (a - s0) / seg), t1 = Math.min(1, (b - s0) / seg);
          const ax = p[0] + (q[0] - p[0]) * t0, ay = p[1] + (q[1] - p[1]) * t0;
          if (!open) { c.moveTo(ax, ay); open = true; }
          c.lineTo(p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1);
        }
      }
    };
    const head = ((T.sf * 2) % 1) * total;
    const tail = total * 0.3;
    N.glow(ctx, ink, 6, pathAll, { intensity: 0.28, halo: 0.6 });
    N.glow(ctx, ink, 6.5, (c) => {
      if (head - tail >= 0) extract(c, head - tail, head);
      else { extract(c, 0, head); extract(c, total + head - tail, total); }
    }, { intensity: 1 });
    // The head itself: where the beam is right now.
    let hx = x0, hy = y0, rem = head;
    for (const l of lines) {
      if (rem > l.len) { rem -= l.len; continue; }
      for (let i = 1; i < l.pts.length; i++) {
        const p = l.pts[i - 1], q = l.pts[i];
        const seg = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (rem <= seg) { const u = seg ? rem / seg : 0; hx = p[0] + (q[0] - p[0]) * u; hy = p[1] + (q[1] - p[1]) * u; break; }
        rem -= seg;
      }
      break;
    }
    N.glowDot(ctx, ink, hx, hy, 9, 1);

    // Lissajous figure: ratio from hour and minute, phase turning with seconds.
    let fa = 1 + (T.h % 5), fb = 2 + (T.m % 5);
    if (fa === fb) fb += 1;
    const ph = T.sf * (Math.PI / 15);
    const LX = 500, LY = 735, RX = 120, RY = 62;
    const pts = 130;
    N.glow(ctx, ink, 5, (c) => {
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * N.TAU;
        const x = LX + RX * Math.sin(fa * a + ph);
        const y = LY + RY * Math.sin(fb * a);
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
    }, { intensity: 0.5, halo: 0.8 });
    // Small bracket frame so the figure reads as a second trace.
    ctx.save();
    ctx.strokeStyle = N.rgba(ink, 0.2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = LX + sx * (RX + 24), cy = LY + sy * (RY + 20);
      ctx.moveTo(cx - sx * 22, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sy * 18);
    }
    ctx.stroke();
    ctx.restore();
  },
});
