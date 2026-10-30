// The rally face's worlds as data, plus the deterministic noise the road and
// props are grown from. Deliberately free of three.js so it stays testable
// and the scene module is the only thing that pulls the 3D chunk in.
//
// The colours here are the world itself (content, like the neon faces' glow),
// not chrome, so they live as data next to the face rather than in tokens.css.

import type { RALLY_CARS, RALLY_WORLDS } from '../../../shared/schemas/face.rally';

export type WorldId = (typeof RALLY_WORLDS)[number];
export type CarId = (typeof RALLY_CARS)[number];
export type WeatherId = 'clear' | 'clouds' | 'rain' | 'snow';
export type LightId = 'morning' | 'noon' | 'sunset' | 'night';

export type PropGeo =
  | 'pine' | 'pineDark' | 'snowpine' | 'round' | 'acacia' | 'palm' | 'rock'
  | 'houseRed' | 'houseBlue' | 'houseWhite' | 'houseYellow' | 'block'
  | 'bale' | 'mound' | 'tuft' | 'flower' | 'grass' | 'lupine' | 'shrub' | 'post' | 'rail';

type Range = [number, number];

export interface PropSpec {
  geo?: PropGeo;
  /** crowd: spectators and sponsor boards at the roadside; posts: markers along both edges. */
  type?: 'crowd' | 'posts';
  /** Items (or clusters) per 60 m stretch; the fraction is a probability. */
  n?: number;
  /** Clear distance from the road edge, metres. */
  gap?: number;
  scale?: Range;
  cluster?: number;
  radius?: number;
  tints?: string[];
  /** Square to the road, like houses along a street. */
  align?: boolean;
  /** Non-uniform scale ranges for unit-box buildings. */
  box?: [Range, Range, Range];
  tilt?: number;
  every?: number;
}

export interface Biome {
  name: string;
  base: string;
  patch: string;
  patch2: string;
  patch2At?: Range;
  shoulder: string;
  shoulderW?: number;
  road: string;
  edge?: string;
  lines?: string;
  tracks?: string;
  hill: number;
  hillF?: number;
  /** No road surface: the car runs on open ground and only its ruts show. */
  offroad?: boolean;
  /** Sharp-crested hills (dunes) instead of rolling ones. */
  ridged?: boolean;
  snowLine?: number;
  /** Road curviness; 1 is the reference. */
  twist: number;
  /** Multiplier on the base speed. */
  pace?: number;
  /** Pushes the haze back; green worlds read washed-out without it. */
  clearAir?: number;
  fog: string;
  sun: [string, number];
  hemi: [string, string, number];
  seed: number;
  /** [colour, how much the surface throws up]. Dust is paler than the soil it comes from. */
  dust: [string, number];
  /** Weather Auto may roll here (repeats make one more likely). */
  weathers: WeatherId[];
  /** Cars Auto may pick here. */
  cars: CarId[];
  props: PropSpec[];
}

export const CROWD = ['#d84a3a', '#3a6fd8', '#f0c23a', '#f2f2f2', '#2f9e6a', '#2a2a2a', '#e07a2f', '#7a4ad8'];

export const BIOMES: Record<WorldId, Biome> = {
  africa: {
    name: 'Africa', base: '#d3a35c', patch: '#c08a45', patch2: '#e0b877', shoulder: '#b8733f', road: '#a65530',
    hill: 2.5, hillF: .03, twist: 1, fog: '#e2bf88', sun: ['#fff1d6', 2.9], hemi: ['#ffe9c4', '#8a5a2a', 1.1], seed: 1,
    dust: ['#f0d2a4', 1.8], weathers: ['clear', 'clear', 'clouds', 'rain'], cars: ['safari', 'safari', 'coupe', 'saloon'],
    props: [
      { geo: 'acacia', n: 14, gap: 4, scale: [1, 1.6] },
      { geo: 'tuft', n: 30, cluster: 10, radius: 3.5, gap: 1.2, scale: [1, 1.8], tints: ['#ffffff', '#e8d6a8'] },
      { geo: 'mound', n: 4, gap: 4, scale: [.6, 1.3] },
      { geo: 'rock', n: 4, gap: 3, scale: [.6, 1.6], tints: ['#c48a5c'] },
      { type: 'crowd', n: .6 },
    ],
  },
  desert: {
    name: 'Desert road', base: '#e3bf7c', patch: '#d6ad66', patch2: '#efd29a', shoulder: '#d8b06a', road: '#77746f', edge: '#ece4d0', lines: '#f3ead2',
    hill: 7, hillF: .018, twist: .7, fog: '#efd6a2', sun: ['#fff3dc', 3], hemi: ['#fff1d8', '#a07a40', 1.1], seed: 2,
    dust: ['#f6e4bf', 1.5], weathers: ['clear', 'clear', 'clouds'], cars: ['coupe', 'wedge', 'saloon'],
    props: [
      { geo: 'palm', n: 2, gap: 5, scale: [.8, 1.2] },
      { geo: 'rock', n: 6, gap: 3, scale: [.6, 2.2], tints: ['#c4935e', '#b5845a'], tilt: .5 },
      { geo: 'shrub', n: 6, cluster: 4, radius: 4, gap: 2, scale: [.6, 1.2] },
      { type: 'posts', every: 14, gap: 1.6 },
      { type: 'crowd', n: .4 },
    ],
  },
  dunes: {
    name: 'Sand dunes', offroad: true, ridged: true, base: '#e7c27c', patch: '#d9ae66', patch2: '#f2d6a0', shoulder: '#e7c27c', shoulderW: 0, road: '#d2a663', tracks: '#c99c5a',
    hill: 16, hillF: .024, twist: 1.25, fog: '#f2d9a6', sun: ['#fff1d4', 3.1], hemi: ['#fff0d0', '#b08040', 1.05], seed: 8,
    dust: ['#f8e6c2', 2.6], weathers: ['clear', 'clear', 'clear', 'clouds'], cars: ['safari', 'safari', 'safari', 'beetle'],
    props: [
      { geo: 'rock', n: 3, gap: 4, scale: [.8, 2.6], tints: ['#c99a62', '#b3845a'], tilt: .5 },
      { geo: 'shrub', n: 3, cluster: 3, radius: 4, gap: 3, scale: [.5, 1] },
      { geo: 'palm', n: .3, gap: 6, scale: [.9, 1.2] },
      { type: 'crowd', n: .25 },
    ],
  },
  snow: {
    name: 'Snow forest', base: '#eef2f6', patch: '#dfe6ee', patch2: '#f8fafc', shoulder: '#e3e9ef', road: '#a9b2ba', tracks: '#848e97',
    hill: 3, hillF: .03, twist: 1.1, fog: '#eaf0f5', sun: ['#fff8ee', 2.4], hemi: ['#e8f0ff', '#9aa6b5', 1.25], seed: 3,
    dust: ['#ffffff', 1.3], weathers: ['clear', 'snow', 'snow', 'clouds'], cars: ['saloon', 'hatch', 'coupe', 'mini'],
    props: [
      { geo: 'snowpine', n: 46, cluster: 2, radius: 3, gap: 3.2, scale: [.7, 1.35] },
      { geo: 'houseRed', n: 1.2, gap: 8, align: true },
      { geo: 'houseBlue', n: .5, gap: 8, align: true },
      { geo: 'rock', n: 3, gap: 3, scale: [.6, 1.4], tints: ['#9aa0a6'] },
      { type: 'posts', every: 12, gap: 1.6 },
      { type: 'crowd', n: .6 },
    ],
  },
  city: {
    name: 'European city', base: '#b7b2a8', patch: '#a9a397', patch2: '#7fa05a', shoulder: '#d6d1c6', shoulderW: 3.6, road: '#55575b', edge: '#f1ede4', lines: '#f1ede4',
    hill: 0, twist: .55, fog: '#cdc8be', sun: ['#fff4e2', 2.8], hemi: ['#f0f0ff', '#8a8478', 1.1], seed: 4,
    dust: ['#ecebe6', .3], weathers: ['clear', 'clouds', 'rain'], cars: ['mini', 'hatch', 'beetle', 'wedge'],
    props: [
      { geo: 'block', n: 60, gap: 6.5, align: true, box: [[4.5, 7.5], [2.5, 6.5], [4.5, 7.5]], tints: ['#ffffff', '#f0e6dc', '#e8ddd0', '#d9d4cc'] },
      { geo: 'round', n: 12, gap: 2.4, scale: [.7, 1] },
      { type: 'crowd', n: .8 },
    ],
  },
  plains: {
    name: 'Plains', clearAir: 1.3, base: '#6fb540', patch: '#8cc94f', patch2: '#d2bc50', patch2At: [.7, .78], shoulder: '#86b552', road: '#696b6f', edge: '#ffffff', lines: '#ffffff',
    hill: 1.6, hillF: .03, twist: .8, fog: '#bfe0a0', sun: ['#fff6e0', 2.9], hemi: ['#eaf6ff', '#4f7f26', 1.1], seed: 5,
    dust: ['#efe9d2', .4], weathers: ['clear', 'clouds', 'rain'], cars: ['hatch', 'beetle', 'saloon', 'mini'],
    props: [
      { geo: 'grass', n: 45, cluster: 12, radius: 3.5, gap: 1.2, scale: [.7, 1.3], tints: ['#ffffff', '#e8f4cf', '#d4eaa8'] },
      { geo: 'round', n: 12, gap: 4, scale: [.8, 1.3] },
      { geo: 'bale', n: 10, gap: 4, scale: [.9, 1.1] },
      { geo: 'houseWhite', n: .5, gap: 8, align: true },
      { geo: 'houseYellow', n: .3, gap: 8, align: true },
      { geo: 'flower', n: 22, cluster: 9, radius: 2.5, gap: 1.4, tints: ['#f2d14b', '#e86a8a', '#ffffff', '#b77be0'] },
      { type: 'posts', every: 12, gap: 1.6 },
      { type: 'crowd', n: .5 },
    ],
  },
  mountains: {
    name: 'Mountains', pace: .6, clearAir: 1.2, base: '#6c9a55', patch: '#5a8746', patch2: '#9aa08c', shoulder: '#8f8f88', road: '#5d5f63', edge: '#ffffff', lines: '#ffffff',
    hill: 15, hillF: .035, snowLine: 6.5, twist: 1.6, fog: '#c6d0d6', sun: ['#fff4e6', 2.7], hemi: ['#dfeaff', '#55604a', 1.1], seed: 6,
    dust: ['#e6e4de', .4], weathers: ['clear', 'clouds', 'snow', 'rain'], cars: ['wedge', 'coupe', 'hatch'],
    props: [
      { geo: 'grass', n: 22, cluster: 9, radius: 3, gap: 1.4, scale: [.6, 1.1], tints: ['#ffffff', '#dfeccb'] },
      { geo: 'pineDark', n: 30, cluster: 3, radius: 4, gap: 4, scale: [.7, 1.2] },
      { geo: 'rock', n: 18, gap: 3, scale: [1, 3.6], tints: ['#9a9a9a', '#85878a'], tilt: .6 },
      { type: 'posts', every: 5, gap: 1.4, geo: 'rail', align: true },
      { type: 'crowd', n: .4 },
    ],
  },
  iceland: {
    name: 'Iceland', clearAir: 1.2, base: '#66983f', patch: '#558736', patch2: '#2f2f31', patch2At: [.62, .72], shoulder: '#5e5a54', road: '#7a766f',
    hill: 4, hillF: .025, twist: .9, fog: '#bfc8c4', sun: ['#eef2f5', 1.9], hemi: ['#dfe6ec', '#4a5040', 1.3], seed: 7,
    dust: ['#c9c4ba', 1.4], weathers: ['clouds', 'rain', 'clear', 'snow'], cars: ['safari', 'saloon', 'beetle'],
    props: [
      { geo: 'grass', n: 26, cluster: 9, radius: 3, gap: 1.2, scale: [.6, 1.1], tints: ['#ffffff', '#d8e8b8', '#c6dca0'] },
      { geo: 'lupine', n: 14, cluster: 10, radius: 3, gap: 1.4, scale: [.8, 1.3], tints: ['#8a5fc9', '#a477e0', '#6e48b0'] },
      { geo: 'rock', n: 20, gap: 2.5, scale: [.5, 1.8], tints: ['#3d3d40', '#4a4a4c'], tilt: .5 },
      { geo: 'houseWhite', n: .4, gap: 8, align: true },
      { type: 'posts', every: 14, gap: 1.6 },
      { type: 'crowd', n: .3 },
    ],
  },
};

/** The light the real clock calls for, in local time. */
export function lightForHour(h: number): LightId {
  if (h >= 5 && h < 9) return 'morning';
  if (h >= 9 && h < 17) return 'noon';
  if (h >= 17 && h < 20) return 'sunset';
  return 'night';
}

// ---------- deterministic noise: the same stretch of road always grows the same world ----------

export function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (k: number, s: number) => (Math.imul(k | 0, 2654435761) ^ Math.imul(s + 1, 40503)) | 0;
export function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, y: number, s: number) => vnoise(x, y, s) * .5 + vnoise(x * 2.1, y * 2.1, s + 1) * .3 + vnoise(x * 4.3, y * 4.3, s + 2) * .2;
export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const pick = <T,>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

/** Road centre x at distance s. Three sines whose frequencies never line up, so the road never repeats. */
export function roadX(s: number, twist: number): number {
  const f = .02 * twist;
  return 16 * (.55 * Math.sin(s * f + 1.3) + .3 * Math.sin(s * f * 2.31 + 4.1) + .15 * Math.sin(s * f * 3.7 + .7));
}
