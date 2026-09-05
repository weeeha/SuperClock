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
];

/** Sort every declared token into exactly one of live / ledgered / dead, and
 *  list ledger entries that went stale (a reader appeared, or the token is no
 *  longer declared) so the ledger cannot quietly outlive its reason. */
export function auditLiveness(tokens, sources, ledger = UNCONSUMED_LEDGER) {
  const ledgered = new Set(ledger.map((e) => e.token));
  const declared = new Set(tokens);
  const out = { live: [], ledgered: [], dead: [], staleLedger: [] };
  for (const token of tokens) {
    if (findReaders(token, sources).length) out.live.push(token);
    else if (ledgered.has(token)) out.ledgered.push(token);
    else out.dead.push(token);
  }
  for (const { token } of ledger) {
    if (!declared.has(token) || findReaders(token, sources).length) out.staleLedger.push(token);
  }
  return out;
}
