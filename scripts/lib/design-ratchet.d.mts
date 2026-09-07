export declare const CEILINGS: { fontSizes: number; colours: number };
export declare const NOT_DESIGN: string[];
export declare const BANNED_HUE_LEDGER: Record<string, number>;
export declare function extractFontSizes(source: string): Set<string>;
export declare function extractColours(source: string): Set<string>;
export declare function hexToHsl(hex: string): { h: number; s: number; l: number } | null;
export declare function isBannedHue(hex: string): boolean;
