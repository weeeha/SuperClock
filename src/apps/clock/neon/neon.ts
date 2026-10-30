// The neon face runtime: the palette, additive glow, a cached-layer helper and
// the one render path shared by NeonCanvas (the kiosk) and the port bench
// (docs/drafts/neon-port/). Ported from the neon drafts (docs/drafts/neon-faces/).
//
// A neon face draws in the 1000-unit square every face and the LVGL renderer
// use: the disc is the circle of radius 500 around (500, 500), and anything
// that tells the time stays inside r 470.
import { clockAngles } from '../../../core/hooks/useClockHands';

/** The neon hues. A face uses one, plus at most one more for a single
 *  quantity (FCE-1, recorded in its meta's accent). Hex lives here, in the
 *  face's own art, the way Minimalismo's gold lives in its meta: the neon is
 *  content, not a palette role, and it does not flip at night. */
export const PALETTE = {
  cyan: '#00F0FF',
  magenta: '#FF2BD6',
  pink: '#FF3D7F',
  // Three hues reuse a colour already on the tree, each within an RGB distance
  // of 14 of the drafted neon (invisible under the glow), so the design
  // ratchet does not grow for them.
  violet: '#a855f7',
  orange: '#ff7012',
  white: '#f0f6fc',
} as const;
// Only the hues the shipped neon faces use: the drafts (docs/drafts/neon-faces/)
// carry the full set, and a hue enters here with the face that needs it,
// because every raw colour in src/apps counts against the design ratchet.

/** The dark glass the neon is mounted on. Content, like the Vinyl record: it
 *  stays dark in both palettes; the mat around the disc is --face-bg. */
export const STAGE = 'rgb(4,4,10)';
export const TAU = Math.PI * 2;

export interface NeonTime {
  date: Date;
  h: number;
  m: number;
  s: number;
  ms: number;
  /** Seconds with the fraction, 0 to 60. */
  sf: number;
  hourDeg: number;
  minuteDeg: number;
  /** Ticks once a second. */
  secondDeg: number;
  /** Sweeps smoothly. */
  sweepDeg: number;
  minuteFrac: number;
  hourFrac: number;
  dayFrac: number;
  hh: string;
  mm: string;
  ss: string;
  /** Ambient seconds since the face mounted: for motion that is not time. */
  t: number;
}

/** Everything a face may know about time. Angles come from clockAngles, the
 *  same formulas useClockHands uses, so the hand-angle source of truth stays
 *  in one place (KIO-3). */
export function neonTime(date: Date, ambientSeconds: number): NeonTime {
  const tick = clockAngles(date, false);
  const sweep = clockAngles(date, true);
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  const ms = date.getMilliseconds();
  const sf = s + ms / 1000;
  const pad = (v: number) => String(v).padStart(2, '0');
  return {
    date, h, m, s, ms, sf,
    hourDeg: tick.hourDeg,
    minuteDeg: tick.minuteDeg,
    secondDeg: tick.secondDeg,
    sweepDeg: sweep.secondDeg,
    minuteFrac: sf / 60,
    hourFrac: (m * 60 + sf) / 3600,
    dayFrac: (h * 3600 + m * 60 + sf) / 86400,
    hh: pad(h), mm: pad(m), ss: pad(s),
    t: ambientSeconds,
  };
}

export type Path = (ctx: CanvasRenderingContext2D) => void;

export interface GlowOptions {
  intensity?: number;
  /** Scales the outer halo passes; 0 draws only the tube and its core. */
  halo?: number;
  core?: boolean;
  cap?: CanvasLineCap;
}

export interface NeonKit {
  c: typeof PALETTE;
  TAU: number;
  rgba(hex: string, a: number): string;
  mix(hex: string, other: string, t: number): string;
  core(hex: string): string;
  polar(cx: number, cy: number, r: number, deg: number): [number, number];
  hash(n: number): number;
  noise(x: number): number;
  clamp(v: number, lo: number, hi: number): number;
  ease(t: number): number;
  glow(ctx: CanvasRenderingContext2D, color: string, width: number, path: Path, opts?: GlowOptions): void;
  glowDot(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, intensity?: number): void;
  seg7(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number, opts?: { off?: boolean; gap?: number }): void;
  /** Draws paint() once into an offscreen layer the size of the canvas and
   *  reuses it until `stamp` changes (for example the minute), so the still
   *  parts of a face cost one drawImage a frame instead of their glow passes.
   *  The layer is composited additively, like every glow: put light in it,
   *  and draw anything that must darken (plates, masks) live. */
  layer(ctx: CanvasRenderingContext2D, state: object, key: string, stamp: string | number, paint: Path): void;
}

/** A neon face: its draw() runs every animation frame in the 1000-unit
 *  space, already clipped to the disc over the dark stage. Method syntax on
 *  draw keeps a face's own state type assignable to NeonFace<object>. */
export interface NeonFace<S extends object = object> {
  id: string;
  /** Render size as a fraction of the device pixels (default 1). Glow-heavy
   *  faces look the same a little under 1 and cost the square less. */
  resolution?: number;
  draw(ctx: CanvasRenderingContext2D, T: NeonTime, N: NeonKit, state: S): void;
}

const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}
const rgba = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
const mix = (hex: string, other: string, t: number) => {
  const a = rgb(hex);
  const b = rgb(other);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const coreCache = new Map<string, string>();
const core = (hex: string) => {
  let v = coreCache.get(hex);
  if (!v) {
    v = mix(hex, '#ffffff', 0.72);
    coreCache.set(hex, v);
  }
  return v;
};
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const noise = (x: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ease = (t: number) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};

// Many thin alpha steps rather than a few thick ones: each pass edge is a
// visible step, so small steps read as a smooth falloff. The last pass is the
// tube itself; a near-white core goes on top.
const PASSES: ReadonlyArray<readonly [number, number]> = [
  [8, 0.016],
  [6.2, 0.022],
  [4.7, 0.032],
  [3.5, 0.048],
  [2.6, 0.075],
  [1.85, 0.12],
  [1.35, 0.2],
  [1, 0.8],
];

const SEG: Record<string, readonly [number, number, number, number]> = {
  a: [0, 0, 1, 0], b: [1, 0, 1, 0.5], c: [1, 0.5, 1, 1], d: [0, 1, 1, 1],
  e: [0, 0.5, 0, 1], f: [0, 0, 0, 0.5], g: [0, 0.5, 1, 0.5],
};
export const DIGIT_SEGS: Record<string, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc',
  5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

interface Layer {
  canvas: HTMLCanvasElement;
  stamp: string | number;
  w: number;
}

/** haloScale 1 is full neon; the face's soft option lowers it for a dark room. */
export function createKit(haloScale = 1): NeonKit {
  const glow: NeonKit['glow'] = (ctx, color, width, path, opts) => {
    const k = opts?.intensity ?? 1;
    if (k <= 0) return;
    const halo = (opts?.halo ?? 1) * haloScale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = opts?.cap ?? 'round';
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
    if (opts?.core !== false) {
      ctx.globalAlpha = Math.min(1, 0.8 * k);
      ctx.strokeStyle = core(color);
      ctx.lineWidth = Math.max(1, width * 0.38);
      ctx.beginPath();
      path(ctx);
      ctx.stroke();
    }
    ctx.restore();
  };

  const glowDot: NeonKit['glowDot'] = (ctx, color, x, y, r, intensity = 1) => {
    if (intensity <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const reach = r * (1 + 3 * Math.max(0.25, haloScale));
    const g = ctx.createRadialGradient(x, y, 0, x, y, reach);
    g.addColorStop(0, rgba(core(color), Math.min(1, 0.95 * intensity)));
    g.addColorStop(0.22, rgba(color, Math.min(1, 0.8 * intensity)));
    g.addColorStop(0.5, rgba(color, 0.16 * intensity));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, reach, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  const seg7: NeonKit['seg7'] = (ctx, ch, x, y, w, h, opts) => {
    const off = Boolean(opts?.off);
    const gap = opts?.gap ?? 0;
    const lit = DIGIT_SEGS[ch] ?? '';
    for (const s of 'abcdefg') {
      if (lit.includes(s) === off) continue;
      const [x1, y1, x2, y2] = SEG[s];
      const ax = x + x1 * w, ay = y + y1 * h, bx = x + x2 * w, by = y + y2 * h;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const ux = ((bx - ax) / len) * gap, uy = ((by - ay) / len) * gap;
      ctx.moveTo(ax + ux, ay + uy);
      ctx.lineTo(bx - ux, by - uy);
    }
  };

  const layer: NeonKit['layer'] = (ctx, state, key, stamp, paint) => {
    const host = state as { __layers?: Map<string, Layer> };
    const store = (host.__layers ??= new Map());
    const W = ctx.canvas.width;
    let L = store.get(key);
    if (!L || L.stamp !== stamp || L.w !== W) {
      const canvas = L?.canvas ?? document.createElement('canvas');
      canvas.width = W;
      canvas.height = W;
      const lctx = canvas.getContext('2d');
      if (!lctx) return;
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, W, W);
      lctx.setTransform(W / 1000, 0, 0, W / 1000, 0, 0);
      paint(lctx);
      L = { canvas, stamp, w: W };
      store.set(key, L);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(L.canvas, 0, 0);
    ctx.restore();
  };

  return { c: PALETTE, TAU, rgba, mix, core, polar, hash, noise, clamp, ease, glow, glowDot, seg7, layer };
}

/** One frame: clear, clip to the disc, paint the stage, let the face draw.
 *  Outside the disc stays transparent so the face's --face-bg mat shows on
 *  the square device. */
export function renderFrame(ctx: CanvasRenderingContext2D, face: NeonFace, kit: NeonKit, state: object, T: NeonTime): void {
  const S = ctx.canvas.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, S, S);
  ctx.setTransform(S / 1000, 0, 0, S / 1000, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.arc(500, 500, 500, 0, TAU);
  ctx.clip();
  ctx.fillStyle = STAGE;
  ctx.fillRect(0, 0, 1000, 1000);
  face.draw(ctx, T, kit, state);
  ctx.restore();
}
