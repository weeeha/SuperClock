// Plasma: a plasma globe. Eight dim filaments crawl from the electrode to the
// glass and keep clear of two bright ones. The thick filament lands on the
// glass at the hour, the thinner one at the minute, and each contact spot
// burns hotter than the filament that feeds it.
NEON.face({
  id: 'plasma',
  name: 'Plasma',
  hue: 'violet',
  idea: 'A plasma globe: an electrode in the middle, eight dim wandering filaments, and two bright ones that touch the glass exactly at the hour and the minute. The hour filament is thicker and its contact burns larger.',
  draw(ctx, T, N, state) {
    const CX = 500, CY = 500;
    const ink = N.c.violet;
    const GLASS = 480, REACH = 466;
    const AMBIENT = 8;
    const SEP = 30;       // degrees ambient filaments keep from a hand

    // Angular difference b - a, wrapped to -180..180.
    const dAng = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

    // A jagged, wandering path from the electrode to the glass. `ang` is where
    // it lands, `amp` how far it may stray sideways. The sideways wander is
    // zero at both ends so it always leaves the electrode and lands on ang.
    const filament = (seed, ang, reach, amp, steps, speed) => {
      const pts = [];
      const a = ((ang - 90) * Math.PI) / 180;
      const ux = Math.cos(a), uy = Math.sin(a);
      const nx = -uy, ny = ux;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const r = 52 + (reach - 52) * u;
        const env = Math.sin(Math.PI * u) ** 0.7;
        // Two octaves: a slow lean and a quick crackle.
        const slow = N.noise(u * 3.2 + T.t * 0.35 * speed + seed * 17) - 0.5;
        const fast = N.noise(u * 11 + T.t * 2.4 * speed + seed * 31) - 0.5;
        const off = (slow * 1.6 + fast * 0.9) * amp * env;
        pts.push(CX + ux * r + nx * off, CY + uy * r + ny * off);
      }
      return pts;
    };
    const trace = (c, pts) => {
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    };

    // The glass: a faint sphere with a rim and one soft highlight.
    const g = ctx.createRadialGradient(CX, CY, 40, CX, CY, GLASS);
    g.addColorStop(0, N.rgba(ink, 0.1));
    g.addColorStop(0.6, N.rgba(ink, 0.03));
    g.addColorStop(1, N.rgba(ink, 0.07));
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(CX, CY, GLASS, 0, N.TAU);
    ctx.fill();
    ctx.restore();
    N.glow(ctx, ink, 3, (c) => c.arc(CX, CY, GLASS, 0, N.TAU), { intensity: 0.22, halo: 0.4 });
    N.glow(ctx, N.c.white, 3, (c) => c.arc(CX, CY, GLASS - 22, Math.PI * 1.08, Math.PI * 1.33), { intensity: 0.08, halo: 0, core: false });

    // Ambient filaments, evenly spread, drifting, and shoved aside near hands.
    const amb = [];
    let ambLit = [];
    for (let i = 0; i < AMBIENT; i++) {
      let ang = (i * 360) / AMBIENT + 40 * Math.sin(T.t * 0.07 + i * 2.1) + 25 * Math.sin(T.t * 0.11 + i);
      let fade = 1;
      for (const h of [T.hourDeg, T.minuteDeg]) {
        const d = dAng(h, ang);
        if (Math.abs(d) < SEP) {
          fade = Math.min(fade, N.ease(Math.abs(d) / SEP));
          ang = h + (d < 0 ? -SEP : SEP);
        }
      }
      const pts = filament(i + 1, ang, 440 + 38 * N.hash(i + 5), 90, 16, 1);
      amb.push(pts);
      ambLit.push(fade);
    }
    // One glow call per brightness band keeps the call count low.
    const bands = [0, 0.5, 0.85];
    for (let b = 0; b < bands.length; b++) {
      const lo = bands[b], hi = bands[b + 1] == null ? 1.01 : bands[b + 1];
      const idx = [];
      for (let i = 0; i < AMBIENT; i++) if (ambLit[i] >= lo && ambLit[i] < hi) idx.push(i);
      if (!idx.length || lo === 0) continue;
      N.glow(ctx, ink, 2.6, (c) => { for (const i of idx) trace(c, amb[i]); }, { intensity: 0.3 * (b === 1 ? 0.6 : 1), halo: 0.8 });
      for (const i of idx) { const p = amb[i]; N.glowDot(ctx, ink, p[p.length - 2], p[p.length - 1], 6, 0.3 * ambLit[i]); }
    }

    // The hands: hour thick, minute thin. Minute drawn first so the hour sits over it.
    const hourPts = filament(41, T.hourDeg, REACH, 26, 22, 0.8);
    const minPts = filament(53, T.minuteDeg, REACH, 22, 22, 0.8);
    N.glow(ctx, ink, 11, (c) => trace(c, minPts), { intensity: 1 });
    N.glow(ctx, ink, 17, (c) => trace(c, hourPts), { intensity: 1 });

    // Contact spots on the glass, brightest points on the dial.
    const flick = 0.88 + 0.12 * N.noise(T.t * 9);
    N.glowDot(ctx, ink, minPts[minPts.length - 2], minPts[minPts.length - 1], 13, flick);
    N.glowDot(ctx, ink, hourPts[hourPts.length - 2], hourPts[hourPts.length - 1], 20, flick);

    // The electrode: a hot ball with a small ring around it.
    N.glowDot(ctx, ink, CX, CY, 34, 1);
    N.glowDot(ctx, N.c.white, CX, CY, 12, 0.8);
    N.glow(ctx, ink, 6, (c) => c.arc(CX, CY, 44, 0, N.TAU), { intensity: 0.7 });
  },
});
