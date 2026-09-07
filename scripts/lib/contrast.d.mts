// Types for contrast.mjs so src/shared/token-contrast.test.ts (inside
// tsconfig.app's strict `include: ["src"]`) can import the .mjs without
// allowJs. The .mjs stays the source of truth; the unit tests are the check
// that keeps this in step with it.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export declare function parseColor(value: string): Rgb | null;
export declare function relativeLuminance(rgb: Rgb): number;
export declare function contrastRatio(a: Rgb, b: Rgb): number;
