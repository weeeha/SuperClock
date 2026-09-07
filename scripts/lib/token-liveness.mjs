// Token liveness predicates. Deliberately free of `node:fs`, like
// token-rules.mjs: the real-tree gate (src/shared/token-liveness.test.ts) owns
// file walking; every judgment is here so vitest can drive it with fixtures.
//
// Why this exists: a token can be declared, themed for night, and mirrored in
// a doc while nothing reads it. Every earlier check looked at the CSS, where
// the token is present and correct, instead of at the tree, where nobody
// consumes it. So this walks declaration → reader and calls the token dead
// when the walk ends at the declaration. Provenance: the three-hop liveness
// test in ds-architecture's starter kit (declared → @theme inline alias →
// component utility). Adapted because SuperClock reads tokens three ways:
//   - kiosk @theme tokens as Tailwind utilities (`bg-accent`, `bg-sheet`,
//     `font-family-display`) or as var();
//   - --face-* as var() in face SVG attributes and style objects;
//   - admin tokens as `hsl(var(--x))` arbitrary values and .admin-root rules.
//
// Known limitation, carried on purpose: a read inside a comment counts. The
// gate under-reports dead tokens rather than inventing a comment stripper
// that would need its own tests to trust.

const DECLARATION_RE = /^\s*(--[\w-]+)\s*:/;

/** Every custom property a stylesheet declares, once each, first-seen order.
 *  A `var()` read is not a declaration: the regex is anchored at line start
 *  and needs the colon that only a declaration has. */
export function declaredTokens(cssText) {
  const seen = new Set();
  const out = [];
  for (const line of cssText.split('\n')) {
    const m = DECLARATION_RE.exec(line);
    if (m && !seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

/** Drop declaration lines so a stylesheet can only count as a reader through
 *  a rule that consumes the token (`background-color: hsl(var(--background))`),
 *  never through the line that declares it. */
export function stripDeclarations(cssText) {
  return cssText
    .split('\n')
    .filter((line) => !DECLARATION_RE.test(line))
    .join('\n');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Tailwind v4 color-namespace utilities. `--color-x` is written as one of
// these followed by `-x`; matching the alias name literally would report every
// colour token in a conformant tree as dead.
const COLOR_UTILITY_PREFIXES =
  'bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration|divide|accent|caret|placeholder';

/** What counts as reading `token`. Always: the token inside parentheses,
 *  which covers `var(--x)` and Tailwind's `bg-(--x)` shorthand, with the
 *  closing paren so `--face-ink` is never satisfied by `--face-ink-muted`.
 *  For kiosk @theme names, additionally the utility Tailwind derives from the
 *  name: `--color-x` → `<prefix>-x`, `--font-x` → `font-x`, with any variant
 *  prefix (`hover:`) and an optional opacity modifier (`/40`). The trailing
 *  lookahead stops a longer utility (`bg-accent-foreground`, `bg-accents`)
 *  from satisfying a shorter token. */
export function readerPattern(token) {
  const parts = [`\\(${escapeRe(token)}\\)`];
  const before = '(?:^|[^\\w-])';
  const variants = '(?:[\\w-]+:)*';
  const after = '(?![\\w-])';
  const color = /^--color-(.+)$/.exec(token);
  if (color) {
    parts.push(`${before}${variants}(?:${COLOR_UTILITY_PREFIXES})-${escapeRe(color[1])}${after}`);
  }
  const font = /^--font-(.+)$/.exec(token);
  if (font) {
    parts.push(`${before}${variants}font-${escapeRe(font[1])}${after}`);
  }
  return new RegExp(parts.join('|'));
}

/** The files among `sources` ({ file, text }) that read `token`. Stylesheets
 *  must be passed through stripDeclarations first; this function does not
 *  know which sources are CSS. */
export function findReaders(token, sources) {
  const re = readerPattern(token);
  return sources.filter((s) => re.test(s.text)).map((s) => s.file);
}

// Tokens declared on purpose but read by nothing yet. May only SHRINK: when a
// token gains a reader the audit reports its entry as stale and the entry
// must be deleted; when the decision is "delete the token", delete both. A
// new token never enters this list — wire it or do not declare it.
export const UNCONSUMED_LEDGER = [
  // Kiosk (src/index.css). Both declared in the first @theme block and never
  // read: WeatherApp colours its dials without them. Deleting changes nothing
  // on glass; wiring them is a weather design decision, not a cleanup.
  {
    token: '--color-temp-high',
    reason: 'weather temperature colour never adopted by WeatherApp; wire into the dials or delete with --color-temp-low',
  },
  {
    token: '--color-temp-low',
    reason: 'weather temperature colour never adopted by WeatherApp; wire into the dials or delete with --color-temp-high',
  },
  // Admin (src/admin/index.css). shadcn slots that no utility can reach:
  // src/admin/index.css has no @theme inline block, so `hover:bg-accent`,
  // `border-input` and `rounded-lg` never resolve to these, and no component
  // writes them as hsl(var(--x)) either. They go live when the admin gets its
  // @theme inline layer (design-system step 2), which shrinks this list.
  {
    token: '--accent',
    reason: 'shadcn hover/accent slot; unreachable until src/admin/index.css gains an @theme inline alias',
  },
  {
    token: '--accent-foreground',
    reason: 'shadcn accent text slot; unreachable until src/admin/index.css gains an @theme inline alias',
  },
  {
    token: '--input',
    reason: 'shadcn border-input slot; admin inputs border with hsl(var(--border)) instead, pending @theme inline',
  },
  {
    token: '--popover-foreground',
    reason: 'shadcn popover text slot; --popover is read by the dialog surface but its foreground never was',
  },
  {
    token: '--radius',
    reason: 'shadcn radius scale; rounded-* utilities do not read it without an @theme inline alias, so admin radii are raw steps today',
  },
  // Token layer (src/styles/tokens.css), brought under this gate 2026-09-06.
  // These are tier 2 roles, not ramps: Task 1 declared each with both modes
  // and its own comment already said "nothing consumes them yet, so they
  // move no pixel today." The tier-aware rule (consumedRamps, applied in
  // src/shared/token-liveness.test.ts) rules out the other reading these
  // could have had, a ramp read only by a role in the same file, so every
  // name below is a genuine dead end today, not a gate blind spot.
  //
  // Group 1: the quick-settings sheet, this sub-project's own proof surface
  // (see the spec's "Proof surface" note). The very next task retokenises
  // src/core/components/QuickSettings.tsx onto these five roles; each entry
  // is deleted in that same change, not carried forward again after.
  {
    token: '--fill-subtle',
    reason: 'quick-settings toggle-off fill; dies when the proof-surface task retokenises QuickSettings.tsx onto tier 2 roles',
  },
  {
    token: '--fill',
    reason: 'quick-settings grab-handle fill; dies when the proof-surface task retokenises QuickSettings.tsx onto tier 2 roles',
  },
  {
    token: '--fill-strong',
    reason: 'quick-settings toggle-on fill; dies when the proof-surface task retokenises QuickSettings.tsx onto tier 2 roles',
  },
  {
    token: '--ink',
    reason: 'quick-settings toggle-knob colour, the chrome ink role used there (not --face-ink); dies when the proof-surface task retokenises QuickSettings.tsx onto tier 2 roles',
  },
  {
    token: '--ink-muted',
    reason: 'quick-settings label and wifi-value colour; dies when the proof-surface task retokenises QuickSettings.tsx onto tier 2 roles',
  },
  // Group 2: the admin's shadcn vocabulary, deferred whole to sub-project 2
  // on 2026-09-06 (spec Scope section) because an @theme inline block would
  // otherwise ship dead utility variables ahead of any consumer. Each entry
  // is deleted when that sub-project's @theme inline block aliases the named
  // shadcn slot onto this role.
  {
    token: '--surface-ground',
    reason: 'admin app background; dies when sub-project 2 aliases --color-background onto this role',
  },
  {
    token: '--surface-card',
    reason: 'admin card background; dies when sub-project 2 aliases --color-card onto this role',
  },
  {
    token: '--surface-sheet',
    reason: 'admin secondary/muted surface; dies when sub-project 2 aliases --color-secondary and --color-muted onto this role',
  },
  {
    token: '--surface-popover',
    reason: 'admin popover background; dies when sub-project 2 aliases --color-popover onto this role',
  },
  {
    token: '--brand',
    reason: 'admin primary/accent colour; dies when sub-project 2 aliases --color-primary and --color-accent onto this role',
  },
  {
    token: '--brand-ink',
    reason: 'admin text on --brand; dies when sub-project 2 aliases --color-primary-foreground and --color-accent-foreground onto this role',
  },
  {
    token: '--status-danger',
    reason: 'admin destructive colour; dies when sub-project 2 aliases --color-destructive onto this role',
  },
  {
    token: '--status-ok',
    reason: 'admin success colour; dies when sub-project 2 aliases --color-success onto this role',
  },
  {
    token: '--status-warn',
    reason: 'admin warning colour; dies when sub-project 2 aliases --color-warning onto this role',
  },
  {
    token: '--status-warn-ink',
    reason: 'admin text on --status-warn; dies when sub-project 2 aliases --color-warning-foreground onto this role',
  },
  {
    token: '--line',
    reason: 'admin border colour; dies when sub-project 2 aliases --color-border and --color-input onto this role',
  },
  {
    token: '--focus',
    reason: 'admin focus-ring colour; dies when sub-project 2 aliases --color-ring onto this role',
  },
];

/** Sort every declared token into exactly one of live / ledgered / dead, and
 *  list ledger entries that went stale (a reader appeared, or the token is no
 *  longer declared) so the ledger cannot quietly outlive its reason.
 *
 *  `extraLive` exists for exactly one shape this source-text search cannot
 *  see: a tier 1 ramp in src/styles/tokens.css, read only by a tier 2 role
 *  declared in the very same file. That read sits on a declaration line
 *  (`--face-bg: var(--stone-0);` both declares --face-bg and reads
 *  --stone-0), so stripDeclarations removes it along with every other
 *  declaration, on purpose: a stylesheet must never count as a reader
 *  through the line that declares the token, or every token would look
 *  self-consuming. The caller (src/shared/token-liveness.test.ts) computes
 *  this set itself, with token-tiers.mjs's consumedRamps, from the same
 *  tier-aware reasoning the tier gate already trusts elsewhere. This is not
 *  a general escape hatch: a token named here is still only live because a
 *  real, tested predicate found a real reference to it, not because someone
 *  decided the search should stop looking. */
export function auditLiveness(tokens, sources, ledger = UNCONSUMED_LEDGER, extraLive = []) {
  const ledgered = new Set(ledger.map((e) => e.token));
  const declared = new Set(tokens);
  const knownLive = new Set(extraLive);
  const out = { live: [], ledgered: [], dead: [], staleLedger: [] };
  for (const token of tokens) {
    if (findReaders(token, sources).length || knownLive.has(token)) out.live.push(token);
    else if (ledgered.has(token)) out.ledgered.push(token);
    else out.dead.push(token);
  }
  for (const { token } of ledger) {
    if (!declared.has(token) || findReaders(token, sources).length || knownLive.has(token)) {
      out.staleLedger.push(token);
    }
  }
  return out;
}
