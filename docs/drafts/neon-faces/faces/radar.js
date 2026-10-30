// Radar: a phosphor scope. The sweep arm is the second hand (one turn a
// minute); the hour and minute are contacts that flare when the beam crosses
// them and cool off behind it. The gallery fades the last frame instead of
// clearing (persist), so everything here is drawn at `persist` strength: a
// thing redrawn every frame settles at its drawn value divided by persist.
NEON.face({
  id: 'radar',
  name: 'Radar',
  hue: 'green',
  idea: 'A phosphor radar scope. The sweep arm turns once a minute with a fading wedge; the hour and minute are contacts that flare as the beam passes them and decay over about two seconds.',
  persist: 0.08,
  draw(ctx, T, N, state) {
    const CX = 500, CY = 500;
    const ink = N.c.green;
    const P = 0.08;                       // must equal `persist`
    const k = (v) => v * P;               // intensity that settles at v
    const rad = (deg) => ((deg - 90) * Math.PI) / 180;

    // Static scope furniture: range rings, crosshair, bearing ticks. All dim.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = N.rgba(ink, k(0.26));
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const r of [150, 300, 450]) {
      ctx.moveTo(CX + r, CY);
      ctx.arc(CX, CY, r, 0, N.TAU);
    }
    ctx.moveTo(CX - 460, CY); ctx.lineTo(CX + 460, CY);
    ctx.moveTo(CX, CY - 460); ctx.lineTo(CX, CY + 460);
    ctx.stroke();
    ctx.strokeStyle = N.rgba(ink, k(0.34));
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 36; i++) {
      const major = i % 3 === 0;
      const [x1, y1] = N.polar(CX, CY, major ? 436 : 448, i * 10);
      const [x2, y2] = N.polar(CX, CY, 462, i * 10);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.restore();

    // The trailing wedge: a conic gradient ending exactly at the arm.
    const wedge = 42;
    if (typeof ctx.createConicGradient === 'function') {
      const g = ctx.createConicGradient(rad(T.sweepDeg - wedge), CX, CY);
      const f = wedge / 360;
      g.addColorStop(0, N.rgba(ink, 0));
      g.addColorStop(f * 0.55, N.rgba(ink, k(0.06)));
      g.addColorStop(f, N.rgba(ink, k(0.5)));
      g.addColorStop(Math.min(1, f + 0.002), N.rgba(ink, 0));
      g.addColorStop(1, N.rgba(ink, 0));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(CX, CY, 462, 0, N.TAU);
      ctx.fill();
      ctx.restore();
    }

    // Faint bearing lines to the two contacts so the hands stay findable
    // between sweeps.
    const hourDeg = T.hourDeg, minDeg = T.minuteDeg;
    N.glow(ctx, ink, 3, (c) => {
      const [hx, hy] = N.polar(CX, CY, 214, hourDeg);
      const [mx, my] = N.polar(CX, CY, 384, minDeg);
      c.moveTo(CX, CY); c.lineTo(hx, hy);
      c.moveTo(CX, CY); c.lineTo(mx, my);
    }, { intensity: k(0.4), halo: 0.4 });

    // The arm itself.
    N.glow(ctx, ink, 6, (c) => {
      const [x, y] = N.polar(CX, CY, 462, T.sweepDeg);
      c.moveTo(CX, CY);
      c.lineTo(x, y);
    }, { intensity: k(1) });

    // Contacts: a steady base, flaring when the beam has just passed. The
    // flare comes from the angle behind the beam, so no stored timers.
    const contact = (deg, r, size, ring) => {
      const behind = (((T.sweepDeg - deg) % 360) + 360) % 360;   // 0 = beam on it
      const flare = Math.exp(-behind / 5.5);                       // about 2 s at 6 deg/s
      const [x, y] = N.polar(CX, CY, r, deg);
      N.glowDot(ctx, ink, x, y, size * (1 + 0.5 * flare), k(0.9));
      N.glowDot(ctx, ink, x, y, size * 0.55, k(0.8 + 0.5 * flare));
      N.glow(ctx, ink, 3, (c) => {
        c.moveTo(x + size * 2.2 + 6 * flare, y);
        c.arc(x, y, size * 2.2 + 6 * flare, 0, N.TAU);
      }, { intensity: k(0.4 + 0.6 * flare), halo: 0.5 });
      // The echo ring that opens as the beam leaves.
      if (flare > 0.02) {
        N.glow(ctx, ink, 3, (c) => {
          const rr = size * 3.2 + (1 - flare) * 34;
          c.moveTo(x + rr, y);
          c.arc(x, y, rr, 0, N.TAU);
        }, { intensity: k(0.5 * flare), halo: 0.3 });
      }
    };
    contact(hourDeg, 230, 15, true);
    contact(minDeg, 400, 10, false);

    // Hub.
    N.glowDot(ctx, ink, CX, CY, 5, k(0.9));

    // Readout: small monospace HH:MM low in the disc on a dark plate.
    ctx.save();
    ctx.fillStyle = 'rgb(4,4,10)';
    ctx.fillRect(CX - 142, 786, 284, 96);
    ctx.font = '700 84px "SF Mono", Menlo, Consolas, "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = `${T.hh}:${T.mm}`;
    N.glow(ctx, ink, 2.4, (c) => c.strokeText(label, CX, 836), { intensity: k(0.9), core: false });
    ctx.fillStyle = N.mix(ink, '#ffffff', 0.35);
    ctx.globalAlpha = 0.95;
    ctx.fillText(label, CX, 836);
    ctx.restore();
  },
});
