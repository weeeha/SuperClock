// Types for lvgl-parity.mjs so src/shared/lvgl-parity.test.ts (inside
// tsconfig.app's strict include: ["src"]) can import the .mjs without
// allowJs. Declares every export the .mjs has; the .mjs stays the source of
// truth. Keep in step with the .mjs by hand; the unit tests are the check.
export interface ParsedGeom {
  geom: Record<string, number>;
  missing: string[];
}
export interface ParsedColors {
  face: string | null;
  hands: Record<string, string | null>;
  tick: string | null;
  dots: Record<string, string | null>;
}
export interface Mismatch {
  field: string;
  react: string | number | null;
  lvgl: string | number | null;
}
export interface DriftEntry {
  field: string;
  reason: string;
}
export declare const GEOM_FIELDS: string[];
export declare function parseGeom(cSource: string): ParsedGeom;
export declare function parseColors(cSource: string): ParsedColors;
export declare function compareToSpec(
  geom: Record<string, number>,
  colors: ParsedColors,
  spec: unknown,
  options: Record<string, unknown>,
): Mismatch[];
export declare const PARITY_DRIFT_LEDGER: DriftEntry[];
