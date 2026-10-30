// Sign: HH:MM as bar-sign lettering. Every numeral is one bent glass tube
// (straight runs and round bends, never seven segments). Where a real glass
// bender would have to jump to a new stroke, the blacked-out return tube is
// painted dim. Small standoffs hold the tube to the wall, the colon breathes
// once a second, and once a minute one stroke stutters like a tired ballast.
NEON.face({
  id: 'sign',
  name: 'Sign',
  hue: 'pink',
  idea: 'HH:MM bent from continuous pink glass tube like a bar sign. Dim blacked-out return tubes join the strokes, the colon breathes, and once a minute one stroke stutters.',
  draw(ctx, T, N, state) {
    const ink = N.c.pink;
    const W = 140, H = 270;       // one numeral cell
    const PITCH = 182;            // digit-to-digit spacing inside HH or MM
    const COLON_GAP = 100;        // clear space between the two pairs
    const CY = 500;

    // A numeral is a list of strokes; a stroke is a list of [x, y, bendRadius]
    // points, drawn with arcTo so every corner is a real bent tube.
    if (!state.ready) {
      const F = {
        0: [[[70, 0], [140, 0, 70], [140, H, 70], [0, H, 70], [0, 0, 70], [70, 0]]],
        1: [[[14, 66], [70, 0, 5], [70, H]]],
        2: [[[0, 70], [0, 0, 70], [140, 0, 70], [140, 110, 46], [0, H, 6], [140, H]]],
        3: [[[0, 64], [0, 0, 64], [140, 0, 64], [140, 135, 64], [46, 135]], [[46, 135], [140, 135, 67], [140, H, 67], [0, H, 67], [0, 206]]],
        4: [[[112, H], [112, 0, 5], [0, 188, 5], [140, 188]]],
        5: [[[140, 0], [12, 0, 6], [12, 128, 6], [140, 128, 66], [140, H, 66], [0, H]]],
        6: [[[132, 0], [0, 0, 44], [0, H, 70], [140, H, 70], [140, 134, 66], [0, 134]]],
        7: [[[0, 0], [140, 0, 5], [48, H]]],
        8: [
          [[70, 135], [140, 135, 67], [140, 0, 67], [0, 0, 67], [0, 135, 67], [70, 135]],
          [[70, 135], [0, 135, 67], [0, H, 67], [140, H, 67], [140, 135, 67], [70, 135]],
        ],
      };
      // A nine is a six hung upside down.
      F[9] = F[6].map((s) => s.map(([x, y, r]) => [140 - x, H - y, r]));
      state.font = F;
      state.ready = true;
    }

    const bend = (c, pts, ox, oy) => {
      c.moveTo(ox + pts[0][0], oy + pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        c.arcTo(ox + pts[i][0], oy + pts[i][1], ox + pts[i + 1][0], oy + pts[i + 1][1], pts[i][2] || 6);
      }
      const e = pts[pts.length - 1];
      c.lineTo(ox + e[0], oy + e[1]);
    };

    // Layout: four numerals around a central colon, one line across the middle.
    const PAIR = PITCH + W;
    const left = 500 - (PAIR * 2 + COLON_GAP) / 2;
    const cell = [0, PITCH, PAIR + COLON_GAP, PAIR + COLON_GAP + PITCH];
    const x0 = left;
    const y0 = CY - H / 2;
    const chars = [T.hh[0], T.hh[1], T.mm[0], T.mm[1]];
    // The "1" is drawn left-heavy; nudge it to the middle of its cell.
    const shiftOf = (ch) => (ch === '1' ? 28 : ch === '7' ? 8 : 0);
    const lenOf = (ch) => state.font[ch].length;

    // The stuttering stroke: same minute, same stroke, every time.
    const sv = N.hash(T.h * 60 + T.m + 0.5);
    const sd = Math.min(3, Math.floor(sv * 4));
    const ss = Math.floor(N.hash(T.h * 60 + T.m + 9.5) * lenOf(chars[sd]));
    const t0 = 6 + Math.floor(N.hash(T.h * 60 + T.m + 3.5) * 40);
    const u = T.sf - t0;
    const dip = (u >= 0 && u < 0.15) || (u >= 0.26 && u < 0.41);
    // A tube also hums a little.
    const hum = 0.95 + 0.05 * N.noise(T.t * 2.3);

    // A very soft wash of light on the wall behind the sign.
    const wash = ctx.createRadialGradient(500, CY, 40, 500, CY, 430);
    wash.addColorStop(0, N.rgba(ink, 0.11));
    wash.addColorStop(1, N.rgba(ink, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, 1000, 1000);

    ctx.save();
    ctx.translate(500, 500);
    ctx.scale(1.1, 1.1);
    ctx.translate(-500, -500);

    // Standoffs: little posts where the tube is clipped to the wall, and the
    // dark return tubes joining one stroke to the next.
    ctx.save();
    ctx.fillStyle = N.rgba(ink, 0.5);
    ctx.strokeStyle = N.rgba(ink, 0.12);
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let d = 0; d < 4; d++) {
      const ox = x0 + cell[d] + shiftOf(chars[d]);
      const strokes = state.font[chars[d]];
      for (let s = 0; s < strokes.length; s++) {
        const p = strokes[s];
        const a = p[0], z = p[p.length - 1];
        ctx.moveTo(ox + z[0], y0 + z[1]);
        if (s + 1 < strokes.length) {
          const nx = strokes[s + 1][0];
          ctx.lineTo(ox + nx[0], y0 + nx[1]);
        }
        ctx.moveTo(ox + a[0], y0 + a[1]);
      }
    }
    ctx.stroke();
    ctx.beginPath();
    for (let d = 0; d < 4; d++) {
      const ox = x0 + cell[d] + shiftOf(chars[d]);
      for (const p of state.font[chars[d]]) {
        for (let i = 0; i < p.length - 1; i++) {
          const ax = p[i][0], ay = p[i][1], bx = p[i + 1][0], by = p[i + 1][1];
          const len = Math.hypot(bx - ax, by - ay);
          const need = (p[i][2] || 0) * (i > 0 ? 1 : 0) + (p[i + 1][2] || 0) * (i + 1 < p.length - 1 ? 1 : 0);
          if (len < need + 40) continue;
          const mx = ox + (ax + bx) / 2, my = y0 + (ay + by) / 2;
          ctx.moveTo(mx + 6, my);
          ctx.arc(mx, my, 6, 0, N.TAU);
        }
      }
    }
    ctx.fill();
    ctx.restore();

    // The lit tube, one glow per stroke so the stutter can pick one.
    for (let d = 0; d < 4; d++) {
      const ox = x0 + cell[d] + shiftOf(chars[d]);
      const strokes = state.font[chars[d]];
      for (let s = 0; s < strokes.length; s++) {
        const stutter = dip && d === sd && s === ss;
        N.glow(ctx, ink, 14, (c) => bend(c, strokes[s], ox, y0), { intensity: (stutter ? 0.14 : 1) * hum });
      }
    }

    // Colon: two tube dots that breathe once a second.
    const cx = x0 + PAIR + COLON_GAP / 2;
    const breathe = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(N.TAU * (T.sf % 1)));
    N.glowDot(ctx, ink, cx, CY - 52, 12, breathe);
    N.glowDot(ctx, ink, cx, CY + 52, 12, breathe);
    ctx.restore();
  },
});
