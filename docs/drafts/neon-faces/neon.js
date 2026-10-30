// Neon faces draft runtime. Not kiosk code: a gallery for choosing faces.
//
// A face is one file in faces/<id>.js that calls NEON.face({...}). Its draw()
// paints into a 1000-unit square (the same space every kiosk face and the
// LVGL renderer use): the disc is the circle of radius 500 around (500, 500),
// and anything load-bearing stays inside r 470. The gallery clears the stage
// each frame, scales to the canvas and clips to the disc before calling draw.
(function (root) {
  'use strict';

  // The neon palette. A face uses one of these as its hue and at most one
  // more as an accent for a single quantity.
  const c = {
    cyan: '#00F0FF',
    magenta: '#FF2BD6',
    pink: '#FF3D7F',
    violet: '#A24BFF',
    blue: '#2D7BFF',
    lime: '#B6FF1A',
    green: '#39FF6A',
    mint: '#2BFFC6',
    yellow: '#FFE81A',
    orange: '#FF7A1A',
    red: '#FF2A3C',
    white: '#F4F7FF',
  };
  const STAGE = 'rgb(4,4,10)';
  const TAU = Math.PI * 2;
  const faces = new Map();

  const rgbCache = new Map();
  function rgb(hex) {
    let v = rgbCache.get(hex);
    if (!v) {
      const n = parseInt(hex.slice(1), 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      rgbCache.set(hex, v);
    }
    return v;
  }
  function rgba(hex, a) {
    const [r, g, b] = rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function mix(hex, other, t) {
    const a = rgb(hex);
    const b = rgb(other);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  /** The near-white centre of a lit tube of this hue. */
  function core(hex) {
    return mix(hex, '#ffffff', 0.72);
  }
  /** 0 deg = 12 o'clock, clockwise. Returns [x, y]. A negative r points behind the centre. */
  function polar(cx, cy, r, deg) {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  /** Deterministic 0..1 from any number: use it instead of Math.random. */
  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  /** Smooth value noise, 0..1. */
  function noise(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return hash(i) * (1 - u) + hash(i + 1) * u;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ease = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Neon without shadowBlur: the same path stroked additively, wide and faint
  // to narrow and bright, then a near-white core. path(ctx) only adds
  // subpaths (moveTo/lineTo/arc...); glow calls beginPath and stroke itself.
  // Many thin alpha steps rather than a few thick ones: each pass edge is a
  // visible step, so small steps read as a smooth falloff.
  const PASSES = [
    [8, 0.016],
    [6.2, 0.022],
    [4.7, 0.032],
    [3.5, 0.048],
    [2.6, 0.075],
    [1.85, 0.12],
    [1.35, 0.2],
    [1, 0.8],
  ];
  function glow(ctx, color, width, path, opts) {
    const o = opts || {};
    const k = o.intensity == null ? 1 : o.intensity;
    if (k <= 0) return;
    const halo = o.halo == null ? 1 : o.halo;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = o.cap || 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    for (let i = 0; i < PASSES.length; i++) {
      const [w, a] = PASSES[i];
      const outer = i < PASSES.length - 1;
      if (outer && halo <= 0) continue;
      ctx.globalAlpha = Math.min(1, a * k * (outer ? halo : 1));
      ctx.lineWidth = width * w;
      ctx.beginPath();
      path(ctx);
      ctx.stroke();
    }
    if (o.core !== false) {
      ctx.globalAlpha = Math.min(1, 0.8 * k);
      ctx.strokeStyle = core(color);
      ctx.lineWidth = Math.max(1, width * 0.38);
      ctx.beginPath();
      path(ctx);
      ctx.stroke();
    }
    ctx.restore();
  }
  /** A glowing point: white-hot centre, hue body, soft falloff to 4r. */
  function glowDot(ctx, color, x, y, r, intensity) {
    const k = intensity == null ? 1 : intensity;
    if (k <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, rgba(core(color), Math.min(1, 0.95 * k)));
    g.addColorStop(0.22, rgba(color, Math.min(1, 0.8 * k)));
    g.addColorStop(0.5, rgba(color, 0.16 * k));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Seven-segment digit paths in a w x h box at (x, y), for faces that want
  // them. Adds subpaths only; wrap in glow(). opts.off draws the unlit
  // segments instead; opts.gap shortens each segment at both ends.
  const SEG = {
    a: [0, 0, 1, 0],
    b: [1, 0, 1, 0.5],
    c: [1, 0.5, 1, 1],
    d: [0, 1, 1, 1],
    e: [0, 0.5, 0, 1],
    f: [0, 0, 0, 0.5],
    g: [0, 0.5, 1, 0.5],
  };
  const DIGIT_SEGS = {
    0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc',
    5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  };
  function seg7(ctx, ch, x, y, w, h, opts) {
    const off = Boolean(opts && opts.off);
    const gap = (opts && opts.gap) || 0;
    const lit = DIGIT_SEGS[ch] || '';
    for (const s of 'abcdefg') {
      if (lit.includes(s) === off) continue;
      const [x1, y1, x2, y2] = SEG[s];
      const ax = x + x1 * w, ay = y + y1 * h, bx = x + x2 * w, by = y + y2 * h;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const ux = ((bx - ax) / len) * gap, uy = ((by - ay) / len) * gap;
      ctx.moveTo(ax + ux, ay + uy);
      ctx.lineTo(bx - ux, by - uy);
    }
  }

  /** Everything a face may know about time. Angles use the kiosk's
   *  useClockHands formulas, so a face ports without recomputing them. */
  function timeState(nowMs, ambientSeconds) {
    const d = new Date(nowMs);
    const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds(), ms = d.getMilliseconds();
    const sf = s + ms / 1000;
    const pad = (v) => String(v).padStart(2, '0');
    return {
      date: d, h, m, s, ms, sf,
      hourDeg: (h % 12) * 30 + m * 0.5,
      minuteDeg: m * 6 + s * 0.1,
      secondDeg: s * 6,
      sweepDeg: sf * 6,
      minuteFrac: sf / 60,
      hourFrac: (m * 60 + sf) / 3600,
      dayFrac: (h * 3600 + m * 60 + sf) / 86400,
      hh: pad(h), mm: pad(m), ss: pad(s),
      t: ambientSeconds,
    };
  }

  function face(def) {
    if (!def || !def.id || typeof def.draw !== 'function') throw new Error('NEON.face needs an id and a draw()');
    faces.set(def.id, def);
  }

  root.NEON = {
    c, STAGE, TAU, faces, face,
    rgb, rgba, mix, core, polar, hash, noise, clamp, ease,
    glow, glowDot, seg7, DIGIT_SEGS, timeState,
  };
})(typeof window !== 'undefined' ? window : globalThis);
