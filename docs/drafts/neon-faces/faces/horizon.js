// Horizon: synthwave. A magenta grid rolls toward you, one spacing a second,
// a striped sun climbs and sets with the day behind a ridge of mountains, and
// the time hangs above it all in cyan tube digits. The sun is the clock's
// slow hand: noon is highest, night is only a glow under the horizon.
NEON.face({
  id: 'horizon',
  name: 'Horizon',
  hue: 'magenta',
  accent: 'cyan',
  accentFor: 'the time',
  idea: 'A synthwave horizon. A magenta grid rolls toward you one line a second, a striped sun rises and sets with the time of day behind dim mountains, and HH:MM floats above in cyan.',
  draw(ctx, T, N, state) {
    const CX = 500, HZ = 566;             // vanishing point and horizon line
    const ink = N.c.magenta;
    const time = N.c.cyan;

    if (!state.ready) {
      // Mountain ridge, built once: low in the middle so the sun shows, taller at the sides.
      const ridge = [];
      for (let i = 0; i <= 46; i++) {
        const x = 24 + i * (952 / 46);
        const side = Math.abs(x - 500) / 476;
        const jag = N.noise(i * 0.55 + 3.1) * 0.7 + N.hash(i + 40) * 0.3;
        ridge.push([x, HZ - (10 + 62 * side * side + 40 * side * jag + 12 * jag)]);
      }
      state.ridge = ridge;
      state.ready = true;
    }

    // Sun: noon highest, centre sinks below the line at night.
    const elev = -Math.cos(T.dayFrac * N.TAU);           // -1 midnight, 1 noon
    const SR = 118;
    const sunY = HZ - 108 * elev + 0;
    const aboveClip = () => { ctx.beginPath(); ctx.rect(0, 0, 1000, HZ); ctx.clip(); };

    // Sky glow behind the sun, clipped to the sky. At night this is all that shows.
    ctx.save();
    aboveClip();
    N.glowDot(ctx, ink, CX, sunY, 70, 0.55 + 0.25 * Math.max(0, elev));
    N.glowDot(ctx, ink, CX, HZ + 40, 100, 0.55 * Math.max(0, 0.35 - elev) / 1.35 + 0.1);
    ctx.restore();

    // Striped sun: horizontal bands, gaps widening toward the bottom.
    ctx.save();
    aboveClip();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, sunY - SR, 0, sunY + SR);
    g.addColorStop(0, N.rgba(N.mix(ink, '#ffffff', 0.55), 0.95));
    g.addColorStop(0.55, N.rgba(ink, 0.9));
    g.addColorStop(1, N.rgba(ink, 0.8));
    ctx.fillStyle = g;
    ctx.beginPath();
    const rows = 48;
    const rh = (2 * SR) / rows;
    const half = (y) => Math.sqrt(Math.max(0, SR * SR - (y - sunY) * (y - sunY)));
    for (let i = 0; i < rows; i++) {
      const f = i / rows;
      // Upper half solid; below that, cut-outs that thicken toward the bottom.
      if (f > 0.3) {
        const gapRows = 1 + Math.floor(((f - 0.3) / 0.7) * 3.4);
        if (i % 6 < gapRows) continue;
      }
      const ya = sunY - SR + i * rh, yb = ya + rh + 0.4;
      const ha = half(ya + 0.01), hb = half(yb - 0.01);
      ctx.moveTo(CX - ha, ya);
      ctx.lineTo(CX + ha, ya);
      ctx.lineTo(CX + hb, yb);
      ctx.lineTo(CX - hb, yb);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();

    // Mountains: a black silhouette that hides the sun's lower edge, edged in dim magenta.
    const ridge = state.ridge;
    ctx.save();
    ctx.fillStyle = N.STAGE;
    ctx.beginPath();
    ctx.moveTo(0, HZ + 1);
    for (const [x, y] of ridge) ctx.lineTo(x, y);
    ctx.lineTo(1000, HZ + 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    N.glow(ctx, ink, 3.5, (c) => {
      c.moveTo(ridge[0][0], ridge[0][1]);
      for (let i = 1; i < ridge.length; i++) c.lineTo(ridge[i][0], ridge[i][1]);
    }, { intensity: 0.5, halo: 0.7 });

    // The ground: perspective grid. Rungs roll toward you, one spacing a second.
    const fr = T.sf % 1;
    const bottom = 1010;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HZ, 1000, 500);
    ctx.clip();
    N.glow(ctx, ink, 4, (c) => {
      for (let k = -10; k <= 10; k++) {
        const bx = CX + k * 150;
        const t = (bottom - HZ) / (bottom - HZ);
        c.moveTo(CX, HZ);
        c.lineTo(CX + (bx - CX) * t * 1.0, bottom);
      }
    }, { intensity: 0.24, halo: 0.7 });
    const rungs = 9;
    for (let j = 0; j < rungs; j++) {
      const u = (j + fr) / rungs;                      // 0 at the horizon, 1 at the viewer
      const y = HZ + 470 * u * u;
      const near = 0.2 + 0.7 * u;
      N.glow(ctx, ink, 3.5 + 2.5 * u, (c) => {
        c.moveTo(0, y);
        c.lineTo(1000, y);
      }, { intensity: near * (u < 0.06 ? u / 0.06 : 1), halo: 0.8 });
    }
    ctx.restore();

    // The horizon line itself, hot.
    N.glow(ctx, ink, 4.5, (c) => {
      c.moveTo(30, HZ);
      c.lineTo(970, HZ);
    }, { intensity: 0.85 });

    // The time: cyan seven-segment tubes, the one thing at full intensity.
    const DW = 84, DH = 172, GAP = 26, COLON = 62;
    const pair = DW * 2 + GAP;
    const x0 = CX - (pair * 2 + COLON) / 2;
    const y0 = 138;
    const digits = [T.hh[0], T.hh[1], T.mm[0], T.mm[1]];
    const px = [x0, x0 + DW + GAP, x0 + pair + COLON, x0 + pair + COLON + DW + GAP];
    N.glow(ctx, time, 3, (c) => {
      for (let i = 0; i < 4; i++) N.seg7(c, digits[i], px[i], y0, DW, DH, { off: true, gap: 9 });
    }, { intensity: 0.1, halo: 0 });
    N.glow(ctx, time, 14, (c) => {
      for (let i = 0; i < 4; i++) N.seg7(c, digits[i], px[i], y0, DW, DH, { gap: 9 });
    }, { intensity: 1 });
    const colonX = x0 + pair + COLON / 2;
    const on = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(N.TAU * (T.sf % 1)));
    N.glowDot(ctx, time, colonX, y0 + DH * 0.3, 8, on);
    N.glowDot(ctx, time, colonX, y0 + DH * 0.7, 8, on);
  },
});
