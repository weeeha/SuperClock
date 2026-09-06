// scripts/lib/token-tiers.mjs
// Predicates for the three-tier token layer. Fs-free, like token-rules.mjs,
// token-liveness.mjs, lvgl-parity.mjs and parts-index.mjs; the real-tree
// gates own reading and globbing.
//
// The layer's whole claim is that tier 2 is the only place a light value and
// a dark value are written. Two things can silently falsify that: a role
// declared in one mode only, which leaves a surface unstyled in the other,
// and a tier 2 role holding a literal, which puts a value somewhere the mode
// flip cannot reach. Both are checked here.

const DECL = /^\s*(--[\w-]+)\s*:\s*([^;]+);/;

/** Break a selector, its declarations and its closing brace onto their own
 *  lines even when a rule is written on one line, so the line-based scan
 *  below sees the same shape it would from ordinary multi-line CSS. A
 *  properly formatted stylesheet already has one line per token; this only
 *  adds harmless blank lines there. */
function normalizeLines(cssText) {
  return cssText.replace(/\{/g, '{\n').replace(/\}/g, '\n}').replace(/;/g, ';\n');
}

/** Split a stylesheet into the tier 1 ramp block and the two tier 2 mode
 *  blocks. Selectors are the contract: `:root` alone is tier 1, the
 *  `:root, html.light` pair is tier 2 light, `html.dark` is tier 2 dark. */
export function parseTiers(cssText) {
  const out = { ramps: [], light: {}, dark: {} };
  let target = null;
  for (const line of normalizeLines(cssText).split('\n')) {
    const trimmed = line.trim();
    if (trimmed.endsWith('{')) {
      const sel = trimmed.slice(0, -1).trim();
      if (sel === ':root') target = 'ramps';
      else if (sel === ':root, html.light' || sel === 'html.light') target = 'light';
      else if (sel === 'html.dark') target = 'dark';
      else target = null;
      continue;
    }
    if (trimmed === '}') { target = null; continue; }
    const m = DECL.exec(line);
    if (!m || !target) continue;
    if (target === 'ramps') out.ramps.push(m[1]);
    else out[target][m[1]] = m[2].trim();
  }
  return out;
}

/** Roles declared in one mode and not the other, in declaration order. */
export function missingModes({ light, dark }) {
  const out = [];
  for (const k of Object.keys(light)) if (!(k in dark)) out.push(k);
  for (const k of Object.keys(dark)) if (!(k in light)) out.push(k);
  return out;
}

/** Tier 2 roles whose value is not a reference to a declared tier 1 ramp. A
 *  literal here is a value the mode flip cannot reach and the ramps cannot
 *  rebrand; a var() pointing at a name outside `ramps` is a typo or a
 *  dangling reference that resolves to nothing at render time, so it is
 *  reported the same way. */
export function tierViolations({ ramps, light, dark }) {
  const knownRamps = new Set(ramps);
  const bad = new Set();
  for (const block of [light, dark]) {
    for (const [name, value] of Object.entries(block)) {
      const ref = /^var\((--[\w-]+)\)$/.exec(value);
      if (!ref || !knownRamps.has(ref[1])) bad.add(name);
    }
  }
  return [...bad];
}
