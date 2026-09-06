// Pure mapping from the app.fireplace schema (intensity, hue) to the particle
// simulation's numbers. The defaults ('medium', 'classic') reproduce the
// pre-schema fire exactly: 3 particles per frame, yellow → orange → red → dark
// flames, an orange ember glow. The other hues are a first cut, meant to be
// tuned on glass; they keep the original three life phases and swap channels.

import type { FireplaceAppConfig } from '../../shared/schemas/app.fireplace';

export type Intensity = FireplaceAppConfig['intensity'];
export type Hue = FireplaceAppConfig['hue'];

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Particles spawned per rendered frame. */
export function spawnPerFrame(intensity: Intensity): number {
  switch (intensity) {
    case 'calm':
      return 1;
    case 'roaring':
      return 6;
    default:
      return 3;
  }
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.floor(v)));

/** Flame colour at life fraction `t` (0 = just spawned, 1 = gone). Three
 *  phases, as in the original: a bright young core (t < 0.2), a mid-life body
 *  whose secondary channel decays (t < 0.5), and a tail that fades to dark. */
export function flameColor(hue: Hue, t: number): RGB {
  let r: number;
  let g: number;
  let b: number;
  switch (hue) {
    case 'cool':
      if (t < 0.2) {
        r = 180; g = 255; b = 255;
      } else if (t < 0.5) {
        r = 60; g = 200 - t * 160; b = 255;
      } else {
        r = 0; g = 0; b = 255 - (t - 0.5) * 400;
      }
      break;
    case 'blue':
      if (t < 0.2) {
        r = 120; g = 170; b = 255;
      } else if (t < 0.5) {
        r = 40; g = 90 - t * 100; b = 255;
      } else {
        r = 0; g = 0; b = 220 - (t - 0.5) * 400;
      }
      break;
    case 'purple':
      if (t < 0.2) {
        r = 240; g = 160; b = 255;
      } else if (t < 0.5) {
        r = 190 - t * 100; g = 40; b = 255;
      } else {
        r = 120 - (t - 0.5) * 240; g = 0; b = 200 - (t - 0.5) * 400;
      }
      break;
    default:
      // classic — the original gradient, verbatim
      if (t < 0.2) {
        r = 255; g = 255; b = 100;
      } else if (t < 0.5) {
        r = 255; g = 180 - t * 200; b = 0;
      } else {
        r = 255 - (t - 0.5) * 400; g = 0; b = 0;
      }
  }
  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

const EMBER: Record<Hue, readonly [number, number, number]> = {
  classic: [255, 100, 0],
  cool: [80, 200, 255],
  blue: [40, 90, 255],
  purple: [170, 60, 255],
};

/** The base glow's rgba() at the given alpha. */
export function emberColor(hue: Hue, alpha: number): string {
  const [r, g, b] = EMBER[hue];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
