export interface ParsedTiers {
  ramps: string[];
  light: Record<string, string>;
  dark: Record<string, string>;
}
export declare function parseTiers(cssText: string): ParsedTiers;
export declare function missingModes(parsed: ParsedTiers): string[];
export declare function tierViolations(parsed: ParsedTiers): string[];
