// Types for comment-strip.mjs, kept beside it like every scripts/lib
// sibling (token-liveness.d.mts, token-rules.d.mts, token-tiers.d.mts,
// lvgl-parity.d.mts, parts-index.d.mts, contrast.d.mts), so a strict .ts
// importer never needs allowJs or an @ts-expect-error pragma. Currently
// that importer is scripts/lib/comment-strip.test.ts; scripts/rulecheck.mjs
// and scripts/lib/token-liveness.mjs both import these two names as plain
// .mjs and re-export them for their own callers. Keep in step with the
// .mjs by hand; the unit tests are the check.

export declare function stripComments(source: string): string;
export declare function stripCssComments(cssText: string): string;
