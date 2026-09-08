// Pure token-contract predicates for scripts/check-tokens.mjs. Deliberately
// free of `node:fs`: the runner owns globbing and exit codes, and keeping this
// module fs-free is what lets vitest unit-test every rule (token-rules.test.ts).
//
// Provenance: the muted-on-muted and cva predicates are ported from
// Super-AI-Components (apps/docs/scripts/lib/token-rules.mjs) per the adopted
// "port, don't rewrite" rule — including their documented limitations. The
// semantic-zone patterns and the face rules are SuperClock's own.

// ---------------------------------------------------------------------------
// Semantic-only zones (src/admin, src/core): styling reaches CSS through
// tokens, never raw values. Known limitation carried over from the ported
// gate: issue refs like "#1234" in comments match the hex pattern — write
// GH-1234 in gated sources instead.
// ---------------------------------------------------------------------------

const SEMANTIC_ZONE_PATTERNS = [
  { re: /#[0-9a-fA-F]{3,8}\b/g, why: 'raw hex color' },
  // `hsl(var(--x))` is the admin's tokenized idiom (no @theme block exists in
  // src/admin/index.css, so semantic colors ride arbitrary values) — the ban
  // is on raw color VALUES, hence the var() lookahead.
  { re: /\b(?:oklch|rgba?|hsla?)\s*\((?!\s*var\()/gi, why: 'raw color function' },
  {
    re: /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    why: 'tailwind palette class',
  },
];

// Escape hatch for values that are data, not styling (e.g. a color-input
// widget's fallback value). The comment must carry a reason on the same line;
// a bare marker is still a finding for a human to question in review.
function lineAllowed(line) {
  return line.includes('token-gate:allow');
}

export function findSemanticZoneViolations(file, source) {
  const found = [];
  source.split('\n').forEach((line, i) => {
    if (lineAllowed(line)) return;
    for (const { re, why } of SEMANTIC_ZONE_PATTERNS) {
      if (re.test(line)) {
        found.push(`${file}:${i + 1} — ${why}: ${line.trim()}`);
      }
      re.lastIndex = 0;
    }
  });
  return found;
}

// ---------------------------------------------------------------------------
// No tier skipping (semantic-only zones only): a component reads a tier 2
// role, or a --face-* alias, never a tier 1 ramp directly, name included.
// SEMANTIC_ZONE_PATTERNS's raw-colour-function rule exempts anything
// followed by var( so the admin's hsl(var(--x)) idiom survives — which also
// means a ramp name spelled as hsl(var(--gray-60)) produced zero findings
// there. This rule closes exactly that gap: it does not care whether a ramp
// name sits inside var(), hsl(var()), or nothing at all, only whether the
// name itself is one of the four prefixes src/styles/tokens.css's tier 1
// block declares. A tier 2 role (--surface-card, --brand, --status-warn) or
// a --face-* alias is not a ramp and is never flagged.
// ---------------------------------------------------------------------------

// The exact prefixes tier 1 uses today (src/styles/tokens.css's own tier 1
// block: --stone-*, the faces' ramp; --gray-*, the admin's; --scrim-*, the
// kiosk's white-alpha fills; --dusk-*, face-specific and on no other ramp).
// A name is only a ramp if it starts with one of these immediately after
// the leading --, so a hypothetical future role that merely contains one of
// these words later in its name (there is none today) is not caught by
// construction, the same "known limitation, not a general parser" trade
// SEMANTIC_ZONE_PATTERNS's own hex rule already documents above.
const TIER1_RAMP_RE = /--(?:stone|gray|scrim|dusk)-[\w-]+/g;

export function findTierSkipViolations(file, source) {
  const found = [];
  source.split('\n').forEach((line, i) => {
    if (lineAllowed(line)) return;
    const m = TIER1_RAMP_RE.exec(line);
    TIER1_RAMP_RE.lastIndex = 0;
    if (m) {
      found.push(`${file}:${i + 1} — tier 1 ramp named directly, skipping tier 2 (${m[0]}): ${line.trim()}`);
    }
  });
  return found;
}

// ---------------------------------------------------------------------------
// Muted-on-muted contrast pairing (ported). shadcn's text-muted-foreground on
// bg-muted/accent/secondary lands at 4.34:1 against a 4.5:1 AA minimum.
// ---------------------------------------------------------------------------

export const MUTED_FG = 'text-muted-foreground';
export const MUTED_BG_RE = /^bg-(?:muted|accent|secondary)(?:\/\d{1,3})?$/;

// May only shrink, never grow. Empty today — SuperClock's admin has no known
// muted-on-muted pairing; the list exists so a future exemption must land
// here with a written reason instead of loosening a rule.
export const CONTRAST_EXEMPT_FILES = [];

export function isExempt(file) {
  return CONTRAST_EXEMPT_FILES.some((name) => file.endsWith(`/${name}`));
}

function classTokens(segment) {
  return segment.split(/\s+/).filter(Boolean);
}

/**
 * The single-element shape: muted text and a muted background inside one
 * quoted class-list literal. Each quoted segment is checked on its own — a
 * ternary's two branches are mutually exclusive at runtime and must not be
 * treated as one combined class list. Variant-prefixed backgrounds
 * (`hover:bg-accent`) do not match MUTED_BG_RE, which is anchored.
 */
export function findSingleStringViolations(file, source) {
  if (isExempt(file)) return [];

  const found = [];
  source.split('\n').forEach((line, i) => {
    for (const match of line.matchAll(/"([^"]*)"|'([^']*)'/g)) {
      const tokens = classTokens(match[1] ?? match[2] ?? '');
      const mutedBgToken = tokens.find((t) => MUTED_BG_RE.test(t));
      if (tokens.includes(MUTED_FG) && mutedBgToken) {
        found.push(
          `${file}:${i + 1} — text-muted-foreground paired with ${mutedBgToken} in one class list (4.34:1 against a 4.5:1 minimum): ${line.trim()}`,
        );
      }
    }
  });
  return found;
}

/**
 * Find every `cva(` call and return its body by balanced-paren scan. A regex
 * cannot do this: variant bodies routinely contain nested calls, and Tailwind
 * arbitrary values are full of parens (`[&:not(:first-child)]`,
 * `max-w-(--x)`). Parens inside strings and comments must not move the depth
 * counter — a single unbalanced paren in a comment would otherwise truncate
 * the body or swallow foreign code into it.
 */
export function extractCvaCalls(source) {
  const calls = [];
  const re = /\bcva\s*\(/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    let quote = null;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      const next = source[i + 1];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
      } else if (ch === '/' && next === '/') {
        while (i < source.length && source[i] !== '\n') i++;
        continue;
      } else if (ch === '/' && next === '*') {
        i += 2;
        while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
        i += 2;
        continue;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
      } else if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }
    if (depth === 0) calls.push({ body: source.slice(start, i - 1), index: m.index });
  }
  return calls;
}

function crossPairViolation(baseTokens, variantTokens) {
  const bgInBase = baseTokens.find((t) => MUTED_BG_RE.test(t));
  const bgInVariant = variantTokens.find((t) => MUTED_BG_RE.test(t));
  if (baseTokens.includes(MUTED_FG) && bgInVariant) return bgInVariant;
  if (variantTokens.includes(MUTED_FG) && bgInBase) return bgInBase;
  return null;
}

/**
 * The cva shape: a base class string that always applies, paired with each
 * variant value string that may apply alongside it. The base MUST be cva's
 * first argument and MUST be a plain string literal; anything else skips the
 * call — under-reporting is the safe direction for a gate whose failures
 * block CI, and promoting a variant value to "base" would pair mutually
 * exclusive values against each other.
 */
export function findCvaViolations(file, source) {
  if (isExempt(file)) return [];

  const found = [];
  const seen = new Set();
  for (const call of extractCvaCalls(source)) {
    const baseMatch = /^\s*(["'])((?:\\.|[^\\])*?)\1/.exec(call.body);
    if (!baseMatch) continue;

    const base = classTokens(baseMatch[2]);
    const rest = call.body.slice(baseMatch[0].length);
    const line = source.slice(0, call.index).split('\n').length;

    for (const m of rest.matchAll(/"([^"]*)"|'([^']*)'/g)) {
      const bg = crossPairViolation(base, classTokens(m[1] ?? m[2] ?? ''));
      // Keyed on the call's offset, not its line: two cva() calls can share a
      // physical line, and a line-based key would drop the second's finding.
      const key = `${call.index}:${bg}`;
      if (bg && !seen.has(key)) {
        seen.add(key);
        found.push(
          `${file}:${line} — cva() pairs text-muted-foreground with ${bg} across its base and a variant value (4.34:1 against a 4.5:1 minimum)`,
        );
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Face rule: night mode is a --face-* token flip (src/index.css), so a face
// that never reads the tokens silently ignores night mode. The face list is
// reconciled from face-components.ts's real imports, never hand-listed.
// ---------------------------------------------------------------------------

// Legacy faces that predate the night token set. May only SHRINK — retrofit a
// face (consume --face-bg/--face-ink at minimum), then delete its line here.
// New faces never enter this list.
export const FACE_TOKEN_EXEMPT = [
  'AnalogClock.tsx',
  'ComplicationsDark.tsx',
  'FlipClock.tsx',
  'FloralClock.tsx',
  'ProductivityClock.tsx',
  'SquareClock.tsx',
  'WorldClock.tsx',
];

/** Default-imported relative modules in face-components.ts are the faces. */
export function parseFaceComponentFiles(source) {
  const names = [];
  for (const m of source.matchAll(/^import\s+(\w+)\s+from\s+'\.\/(\w+)';?$/gm)) {
    names.push(m[2]);
  }
  return names;
}

export function findFaceTokenGap(file, source) {
  if (FACE_TOKEN_EXEMPT.some((name) => file.endsWith(`/${name}`))) return null;
  if (source.includes('--face-')) return null;
  return `${file} — face never reads a --face-* token, so night mode cannot reach it (see src/index.css @theme; consume --face-bg/--face-ink or retrofit deliberately)`;
}
