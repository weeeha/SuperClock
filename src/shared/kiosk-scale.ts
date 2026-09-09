// The kiosk's type and grey scales, in SVG user units on the 1000x1000 face
// viewBox and as fill/stroke strings.
//
// Decided 2026-09-07. The kiosk carried 60 distinct font sizes with nothing to
// conform to, because src/apps sits outside the token gate. These five steps
// are the four frequency peaks in the existing code (16, 22, 26, 34) plus one
// above them, so migrating onto the scale moves most call sites by nothing.
//
// It lives in TypeScript rather than in @theme because these are SVG
// `fontSize` numbers, not CSS lengths: a var() would not resolve there.
//
// DELIBERATELY NOT IN THE SCALE: a face's display numerals. Minimalismo's
// 280 and the fitness readout's 168 are proportions of a specific dial, and a
// face's look is the product — forcing them onto a shared step would change
// designs to satisfy a table. Faces read their numbers from their own
// `.meta.json` spec. This scale governs chrome, labels and app UI.
export const TYPE = {
  /** Captions, unit labels, the small print under a value. */
  xs: 16,
  /** Secondary text: sub-labels, list metadata. */
  sm: 22,
  /** Body — the default for anything read at a glance. */
  md: 26,
  /** Section headings and primary labels. */
  lg: 34,
  /** The largest step that is still chrome rather than face design. */
  xl: 44,
} as const;

export type TypeStep = keyof typeof TYPE;

// ── The neutral grey ramp ────────────────────────────────────────────────────
//
// 44 of the kiosk's 121 raw colours were near-greys, several of them the same
// colour written twice. Seven steps, taken from the lightness values already
// most used rather than invented.
//
// Here and not in @theme for the same reason as TYPE above: these are SVG
// `fill` and `stroke` strings in TypeScript, and a CSS var() does not resolve
// in a bare presentation attribute. Declaring them in CSS was the first
// attempt, and the token-liveness gate correctly refused seven tokens nothing
// read — holding a target by ledgering them would have been gaming it.
//
// Pure black and white are NOT steps: they belong to the night palette
// (--face-bg / --face-ink) and Phase 0 reserves them.
//
// Tinted greys stay out deliberately. GitHub's #8b949e is its own palette and
// the Fitness cream face's #8b8279 is that face's ink; both are specific
// designs rather than drift toward neutral.
//
// This is the target. Apps migrate onto it in their own design passes; the
// ratchet in scripts/lib/design-ratchet.mjs stops the count climbing back
// meanwhile.
export const GREY = {
  950: '#0d0d0d',
  900: '#1c1c1c',
  800: '#2a2a2a',
  700: '#444444',
  600: '#666666',
  500: '#888888',
  300: '#cccccc',
} as const;

export type GreyStep = keyof typeof GREY;
