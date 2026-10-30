// Nixie: four glass tubes in a 2 by 2 block, HH over MM. Each tube holds ten
// stacked cathode numerals; only the one with current on it glows orange. The
// mesh and the unlit numerals are dim furniture, the lit numeral is the
// brightest thing on the dial.
NEON.face({
  id: 'nixie',
  name: 'Nixie',
  hue: 'orange',
  idea: 'Four nixie tubes in a 2 by 2 block. Ten cathode numerals are stacked inside each glass; the lit one glows orange with a white core. A changed digit fades out as the next ignites, and two neon dots between the rows blink with the seconds.',
  draw(ctx, T, N, state) {
    const ink = N.c.orange;
    const TW = 220, TH = 306;         // tube envelope
    const GX = 32, GY = 34;           // gaps between tubes
    const DW = 120, DH = 206;         // numeral box
    const FADE = 0.12;                // seconds for the old numeral to die

    // Cathode numerals as thin nixie wire in the unit box (0..1 x 0..1).
    // Each is a list of subpaths; 'e' is an ellipse [cx, cy, rx, ry].
    const GLYPH = [
      [['e', 0.5, 0.5, 0.5, 0.5]],
      [['M', 0.18, 0.22, 'L', 0.55, 0, 'L', 0.55, 1]],
      [['M', 0.06, 0.26, 'C', 0.06, -0.06, 0.94, -0.06, 0.94, 0.28, 'C', 0.94, 0.55, 0.3, 0.7, 0.04, 1, 'L', 0.96, 1]],
      [['M', 0.08, 0.1, 'C', 0.3, -0.05, 0.92, -0.02, 0.9, 0.25, 'C', 0.88, 0.46, 0.55, 0.48, 0.38, 0.48, 'C', 0.62, 0.48, 0.96, 0.52, 0.94, 0.76, 'C', 0.92, 1.05, 0.3, 1.05, 0.04, 0.88]],
      [['M', 0.72, 1, 'L', 0.72, 0, 'L', 0.02, 0.7, 'L', 1, 0.7]],
      [['M', 0.9, 0, 'L', 0.18, 0, 'L', 0.1, 0.46, 'C', 0.5, 0.34, 0.96, 0.44, 0.96, 0.72, 'C', 0.96, 1.04, 0.3, 1.05, 0.04, 0.86]],
      [['M', 0.88, 0.06, 'C', 0.5, -0.06, 0.06, 0.14, 0.06, 0.66, 'C', 0.06, 1.06, 0.94, 1.06, 0.94, 0.7, 'C', 0.94, 0.34, 0.3, 0.3, 0.09, 0.64]],
      [['M', 0.04, 0, 'L', 0.96, 0, 'L', 0.36, 1]],
      [['e', 0.5, 0.25, 0.38, 0.25], ['e', 0.5, 0.75, 0.46, 0.25]],
      [['M', 0.12, 0.3, 'C', 0.5, 0.36, 0.91, 0.56, 0.94, 0.34, 'C', 0.97, -0.06, 0.06, -0.06, 0.06, 0.34, 'C', 0.06, 0.7, 0.7, 0.7, 0.94, 0.34, 'L', 0.94, 0.34, 'C', 0.94, 0.7, 0.5, 1, 0.12, 0.94]],
    ];
    // Nine is the six turned upside down: cleaner than hand-drawing a second hook.
    GLYPH[9] = GLYPH[6].map((sp) => sp.slice());
    const flip9 = (i) => i === 9;

    function drawGlyph(c, d, x, y, w, h) {
      const flip = flip9(d);
      const X = (u) => x + (flip ? 1 - u : u) * w;
      const Y = (v) => y + (flip ? 1 - v : v) * h;
      for (const sp of GLYPH[d]) {
        if (sp[0] === 'e') {
          const [, cx, cy, rx, ry] = sp;
          c.moveTo(X(cx) + rx * w, Y(cy));
          c.ellipse(X(cx), Y(cy), rx * w, ry * h, 0, 0, N.TAU);
          continue;
        }
        for (let i = 0; i < sp.length;) {
          const op = sp[i++];
          if (op === 'M') { c.moveTo(X(sp[i]), Y(sp[i + 1])); i += 2; }
          else if (op === 'L') { c.lineTo(X(sp[i]), Y(sp[i + 1])); i += 2; }
          else { c.bezierCurveTo(X(sp[i]), Y(sp[i + 1]), X(sp[i + 2]), Y(sp[i + 3]), X(sp[i + 4]), Y(sp[i + 5])); i += 6; }
        }
      }
    }

    const digits = T.hh + T.mm;
    if (!state.ready) {
      state.d = [0, 1, 2, 3].map((i) => ({ cur: digits[i], prev: digits[i], t0: -99 }));
      state.ready = true;
    }

    const colX = [500 - (TW + GX / 2), 500 + GX / 2];
    const rowY = [500 - (TH + GY / 2), 500 + GY / 2];

    for (let i = 0; i < 4; i++) {
      const tx = colX[i % 2], ty = rowY[i >> 1];
      const st = state.d[i];
      if (digits[i] !== st.cur) { st.prev = st.cur; st.cur = digits[i]; st.t0 = T.t; }
      const age = T.t - st.t0;
      const born = N.ease(age / FADE);
      // Ignition: the new numeral stutters in for a few frames before it holds.
      const ign = age < 0.25 ? 0.7 + 0.3 * N.hash(Math.floor(age * 40) + i * 9) : 1;
      const dx = tx + (TW - DW) / 2, dy = ty + 56;
      const cx = tx + TW / 2, cy = dy + DH / 2;

      // Glass envelope: a faint body fill, an outer wall and a thinner inner wall.
      const env = (c, inset) => {
        const r = TW / 2 - inset;
        c.moveTo(tx + inset, ty + TH - 24);
        c.lineTo(tx + inset, ty + TW / 2);
        c.arc(cx, ty + TW / 2, r, Math.PI, 0);
        c.lineTo(tx + TW - inset, ty + TH - 24);
      };
      ctx.save();
      ctx.beginPath();
      env(ctx, 0);
      ctx.lineTo(tx, ty + TH - 24);
      ctx.fillStyle = N.rgba(ink, 0.025);
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = N.rgba(ink, 0.3);
      ctx.stroke();
      ctx.beginPath();
      env(ctx, 7);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = N.rgba(ink, 0.12);
      ctx.stroke();
      // A glass highlight down the left shoulder.
      ctx.beginPath();
      ctx.moveTo(tx + 20, ty + 90);
      ctx.lineTo(tx + 20, ty + 190);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.stroke();
      // The socket the tube stands in.
      ctx.fillStyle = N.rgba(ink, 0.09);
      ctx.fillRect(tx - 6, ty + TH - 24, TW + 12, 24);
      ctx.strokeStyle = N.rgba(ink, 0.3);
      ctx.lineWidth = 2;
      ctx.strokeRect(tx - 6, ty + TH - 24, TW + 12, 24);
      ctx.restore();

      // Honeycomb mesh, clipped to the straight part of the glass.
      ctx.save();
      ctx.beginPath();
      ctx.rect(tx + 12, ty + 44, TW - 24, TH - 80);
      ctx.clip();
      ctx.beginPath();
      const S = 16, W = S * 1.732, RH = S * 1.5;
      for (let r = 0; r < 11; r++) {
        const y0 = ty + 34 + r * RH;
        for (let k = 0; k < 9; k++) {
          const x = tx + 4 + (k * W) / 2;
          const y = y0 + ((k + r) % 2 === 0 ? S / 2 : 0);
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          if ((k + r) % 2 === 0 && r < 10) { ctx.moveTo(x, y); ctx.lineTo(x, y + S); ctx.moveTo(x, y); }
        }
      }
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = N.rgba(ink, 0.075);
      ctx.stroke();
      ctx.restore();

      // All ten cathodes stacked behind, barely there.
      ctx.save();
      ctx.beginPath();
      for (let d = 0; d < 10; d++) drawGlyph(ctx, d, dx, dy, DW, DH);
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = N.rgba(ink, 0.06);
      ctx.stroke();
      ctx.restore();

      // The live numeral, and the one dying under it.
      if (born < 1) N.glow(ctx, ink, 9, (c) => drawGlyph(c, +st.prev, dx, dy, DW, DH), { intensity: 1 - born });
      N.glow(ctx, ink, 9, (c) => drawGlyph(c, +st.cur, dx, dy, DW, DH), { intensity: Math.max(0.01, born * ign) });
    }

    // Two neon dots between the rows, on for the first half of each second.
    const on = T.sf % 1 < 0.5 ? 1 : 0.1;
    N.glowDot(ctx, ink, 484, 500, 7, 0.9 * on);
    N.glowDot(ctx, ink, 516, 500, 7, 0.9 * on);
  },
});
