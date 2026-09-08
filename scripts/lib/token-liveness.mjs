// Token liveness predicates. This module's own code touches no files, and
// neither does anything it imports: the one cross-import below
// (stripComments and stripCssComments, from ./comment-strip.mjs) is a pure,
// fs-free sibling under scripts/lib, so every judgment is still here for
// vitest to drive with fixtures, the same as token-rules.mjs; the
// real-tree gate (src/shared/token-liveness.test.ts) still owns file
// walking.
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
// A read inside a comment used to count, kept on purpose: a comment stripper
// looked like it would need its own tests to trust before this gate could
// rely on it. That trade failed four times in one sub-project: a comment in
// a new token file had to be reworded because it falsely revived a ledgered
// token, twelve ledger reasons had to be corrected partly for the same
// reason, a tier 2 role, --sheet-bg, passed this gate with no rendering
// consumer because a comment happened to name it, and a reviewer then found
// the same shape again at src/styles/tokens.css:57. scripts/rulecheck.mjs
// had already paid the "own tests to trust" cost, comment- and
// string-aware, for its .ts/.tsx scan; CSS needed its own block-comment-only
// variant, same technique, narrowed to the grammar CSS actually has (CSS has
// no line-comment form: an unquoted, protocol-relative url() may contain a
// bare double slash that is ordinary CSS text, not a comment opener). Both
// variants live in scripts/lib/comment-strip.mjs, a pure sibling module
// under scripts/lib, and are fixture-tested directly there. This module
// only imports and re-exports them: for findReaders's own pre-stripping
// below, and for src/shared/token-liveness.test.ts, which imports both by
// name from here. An earlier version of this file imported stripComments
// straight from scripts/rulecheck.mjs (a runner, node:fs at module scope
// for its own CLI) and defined a second, smaller stripCssComments locally
// to avoid touching that runner. Both worked but cost something: this
// module transitively loaded node:fs despite touching no files itself, and
// the local stripCssComments duplicated most of stripComments's state
// machine by hand. The shared module fixes both: nothing here pulls in
// node:fs, directly or transitively, and the two dialects share one
// implementation instead of two near-copies. Every source a caller hands to
// findReaders must still be pre-stripped through the one that matches its
// type, the same way stripDeclarations already works for CSS. Run against
// the real tree (src/shared/token-liveness.test.ts), the only token this
// changed the textual evidence for is --scrim-knob (the
// src/styles/tokens.css:57 case), and it stays live regardless: a
// tier-aware structural predicate (consumedRamps, see auditLiveness's
// extraLive below) already covered it, so the audited live/dead/ledgered
// sets are unchanged.

export { stripComments, stripCssComments } from './comment-strip.mjs';

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

/** The files among `sources` ({ file, text }) that read `token`. Every
 *  source must arrive pre-cleaned: stylesheets through stripDeclarations,
 *  and every source through the comment stripper for its type
 *  (stripComments for .ts/.tsx, stripCssComments for .css). This function
 *  does not know which sources are CSS or which lines were comments; it
 *  only tests the pattern against whatever text it is given. */
export function findReaders(token, sources) {
  const re = readerPattern(token);
  return sources.filter((s) => re.test(s.text)).map((s) => s.file);
}

// Tokens declared on purpose but read by nothing yet. May only SHRINK: when a
// token gains a reader the audit reports its entry as stale and the entry
// must be deleted; when the decision is "delete the token", delete both.
//
// Its exact membership is pinned in scripts/lib/token-liveness.test.ts, the
// same discipline FACE_TOKEN_EXEMPT already has in token-rules.test.ts, so
// an addition or a removal fails that pin first and must edit it in the
// same diff. Shrink-only is an enforced constraint here, not only a
// description of what has happened so far. The list grew from 7 entries to
// 21 during the 2026-09-06 token-layer work: a deliberate one-time addition
// of 14 tier 2 roles (Group 1 and Group 2 below), each declared ahead of
// its sub-project-2 consumer, not drift. The spec's Scope section says why:
// an @theme inline block would otherwise ship dead variables to every Pi
// before anything writes them. That one-time exception is closed: ordinary
// work still never adds a token here, named future consumer or not; wire it
// or do not declare it.
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
  // (see the spec's "Proof surface" note). The proof-surface task
  // retokenised src/core/components/QuickSettings.tsx onto the three fill
  // roles below directly, so they are gone from this list: a real reader
  // now exists. --ink and --ink-muted stayed ledgered instead of joining
  // them: both invert between modes (they are the admin's light-surface/
  // dark-surface text roles), which is wrong for a sheet whose surface is
  // fixed dark in both palettes (src/index.css's --color-sheet comment
  // says so). The sheet's text and its toggle knob read new, deliberately
  // mode-invariant roles instead (--sheet-ink, --fill-knob, both declared
  // in src/styles/tokens.css tier 2), wired in the same change that added
  // them, so neither ever entered this ledger.
  {
    token: '--ink',
    reason: 'admin text-on-surface colour, inverts between modes by design; wrong for the always-dark quick-settings sheet, which reads the new mode-invariant --fill-knob for its toggle knob instead (see the Group 1 comment above). Awaits a genuinely mode-dependent consumer, e.g. the admin in sub-project 2',
  },
  {
    token: '--ink-muted',
    reason: 'admin muted text-on-surface colour, inverts between modes by design; wrong for the always-dark quick-settings sheet, which reads the new mode-invariant --sheet-ink for its labels and wifi value instead (see the Group 1 comment above). Awaits a genuinely mode-dependent consumer, e.g. the admin in sub-project 2',
  },
  // Group 2: the admin's shadcn vocabulary, deferred whole to sub-project 2
  // on 2026-09-06 (spec Scope section) because an @theme inline block would
  // otherwise ship dead utility variables ahead of any consumer. Each entry
  // is deleted when a component writes hsl(var(--role-name)) directly, or
  // when the gate gains a tier-aware alias-plus-utility predicate.
  {
    token: '--surface-ground',
    reason: 'admin app background; the --color-background alias sub-project 2 plans only adds a declaration line the gate strips, so this stays unreachable until a component writes hsl(var(--surface-ground)) directly or the gate gains a tier-aware alias-plus-utility predicate',
  },
  {
    token: '--surface-card',
    reason: 'admin card background; aliasing --color-card onto this role is a declaration line stripDeclarations removes along with the reference inside it, so retiring this entry needs a component that writes hsl(var(--surface-card)) directly or a consumedRamps-style predicate that credits the alias',
  },
  {
    token: '--surface-sheet',
    reason: 'admin secondary/muted surface; the --color-secondary and --color-muted aliases sub-project 2 plans are declaration lines the gate strips, leaving this ledgered until a component writes hsl(var(--surface-sheet)) directly or the gate learns to see through the alias-plus-utility path',
  },
  {
    token: '--surface-popover',
    reason: 'admin popover background; aliasing --color-popover onto this role only creates a declaration line the gate strips, so this stays unreachable until a component writes hsl(var(--surface-popover)) directly or the gate gains a tier-aware predicate that credits the alias',
  },
  {
    token: '--brand',
    reason: 'admin primary/accent colour; the --color-primary and --color-accent aliases sub-project 2 plans are declaration lines the gate strips, so retiring this entry needs a component that writes hsl(var(--brand)) directly or a consumedRamps-style predicate for the alias-plus-utility path',
  },
  {
    token: '--brand-ink',
    reason: 'admin text on --brand; aliasing --color-primary-foreground and --color-accent-foreground onto this role only adds declaration lines the gate strips, leaving this ledgered until a component writes hsl(var(--brand-ink)) directly or the gate gains a tier-aware alias-plus-utility predicate',
  },
  {
    token: '--status-danger',
    reason: 'admin destructive colour; the --color-destructive alias sub-project 2 plans is a declaration line the gate strips, so this stays unreachable until a component writes hsl(var(--status-danger)) directly or a tier-aware predicate credits the alias',
  },
  {
    token: '--status-ok',
    reason: 'admin success colour; aliasing --color-success onto this role only creates a declaration line the gate strips, so retiring this entry needs a component that writes hsl(var(--status-ok)) directly or a consumedRamps-style predicate for the alias-plus-utility path',
  },
  {
    token: '--status-warn',
    reason: 'admin warning colour; the --color-warning alias sub-project 2 plans is only a declaration line the gate strips, leaving this ledgered until a component writes hsl(var(--status-warn)) directly or the gate learns to see through the alias-plus-utility path',
  },
  {
    token: '--status-warn-ink',
    reason: 'admin text on --status-warn; aliasing --color-warning-foreground onto this role only adds a declaration line the gate strips, so this stays unreachable until a component writes hsl(var(--status-warn-ink)) directly or the gate gains a tier-aware predicate that credits the alias',
  },
  {
    token: '--line',
    reason: 'admin border colour; the --color-border and --color-input aliases sub-project 2 plans are declaration lines the gate strips, so retiring this entry needs a component that writes hsl(var(--line)) directly or a consumedRamps-style predicate for the alias-plus-utility path',
  },
  {
    token: '--focus',
    reason: 'admin focus-ring colour; aliasing --color-ring onto this role only creates a declaration line the gate strips, leaving this ledgered until a component writes hsl(var(--focus)) directly or the gate gains a tier-aware alias-plus-utility predicate',
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
