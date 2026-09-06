// Types for token-rules.mjs so src/shared/part-contracts.test.ts (inside
// tsconfig.app's strict `include: ["src"]`) can import the .mjs without
// allowJs. Only the two exports src/ imports; the .mjs stays the source of
// truth. Keep in step with the .mjs by hand; the unit tests are the check.
export declare const FACE_TOKEN_EXEMPT: string[];
export declare function parseFaceComponentFiles(source: string): string[];
