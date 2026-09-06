// React ↔ LVGL parity for the one face both renderers draw. Reads the geom_t
// initializer and the colour calls out of slow-native/src/clock_face.c and
// diffs them against the face's meta spec. Fs-free like token-rules.mjs; the
// real-tree gate (src/shared/lvgl-parity.test.ts) reads the files.
//
// A regex parser over one file is enough for one initializer, on one
// condition: it must never report clean because the initializer moved.
// parseGeom therefore returns the fields it could NOT find, and the gate
// fails on any. Colours it cannot read come back null and show up as
// mismatches against null.

export const GEOM_FIELDS = [
  'face_r',
  'hour_fwd',
  'min_fwd',
  'sec_back',
  'sec_fwd',
  'hour_w',
  'min_w',
  'sec_w',
  'hour_tick_outer',
  'hour_tick_inner',
  'min_tick_outer',
  'min_tick_inner',
  'hour_tick_w',
  'min_tick_w',
  'dot_outer',
  'dot_inner',
];

/** `.hour_fwd = (int32_t)(280 * s),` → { hour_fwd: 280 }. Only the
 *  1000-space constants are read; `.center = viewport_px / 2` is not one. */
export function parseGeom(cSource) {
  const geom = {};
  for (const m of cSource.matchAll(/\.(\w+)\s*=\s*\(int32_t\)\(\s*(\d+)\s*\*\s*s\s*\)/g)) {
    geom[m[1]] = Number(m[2]);
  }
  const missing = GEOM_FIELDS.filter((f) => !(f in geom));
  return { geom, missing };
}

function colorOf(expr, defines) {
  const e = expr.trim();
  if (e === 'lv_color_white()') return '#ffffff';
  if (e === 'lv_color_black()') return '#000000';
  if (defines[e]) return defines[e];
  const hex = /lv_color_hex\(0x([0-9a-fA-F]{6})\)/.exec(e);
  return hex ? `#${hex[1].toLowerCase()}` : null;
}

export function parseColors(cSource) {
  const defines = {};
  for (const m of cSource.matchAll(/#define\s+(COLOR_\w+)\s+lv_color_hex\(0x([0-9a-fA-F]{6})\)/g)) {
    defines[m[1]] = `#${m[2].toLowerCase()}`;
  }
  const face = /set_style_bg_color\(face,\s*([^,]+),/.exec(cSource);
  const tick = /set_style_line_color\(tick,\s*([^,]+),/.exec(cSource);
  const hands = {};
  for (const m of cSource.matchAll(/make_hand\(parent,\s*([^,]+),\s*s->g\.(hour|min|sec)_w\)/g)) {
    hands[m[2]] = colorOf(m[1], defines);
  }
  // The colour argument is greedy up to the LAST paren on the line, not
  // `[^)]+`: make_dot's colour is its final argument, and lv_color_black()
  // and lv_color_white() carry their own closing paren, which a
  // stop-at-first-`)` class would truncate before reaching it.
  const dots = {};
  for (const m of cSource.matchAll(/make_dot\(parent,\s*s->g\.center,\s*s->g\.dot_(outer|inner),\s*(.+)\)/g)) {
    dots[m[1]] = colorOf(m[2], defines);
  }
  return {
    face: face ? colorOf(face[1], defines) : null,
    hands,
    tick: tick ? colorOf(tick[1], defines) : null,
    dots,
  };
}

/** Spec colours for comparison: config:<key> reads the option default the
 *  gate passes in; a --token cannot equal a C literal and stays as-is (a
 *  real mismatch, ledgered with its reason); literals are lower-cased. */
function specColor(value, options) {
  if (value === undefined) return undefined;
  if (value.startsWith('config:')) {
    const v = options[value.slice('config:'.length)];
    return typeof v === 'string' ? v.toLowerCase() : null;
  }
  return value.toLowerCase();
}

/** Every spec field that has a C twin, with the number the twin holds. Dot
 *  values are radii in the spec and diameters in C. */
export function compareToSpec(geom, colors, spec, options) {
  const out = [];
  const check = (field, react, lvgl) => {
    if (react === undefined) return;
    if (react !== lvgl) out.push({ field, react, lvgl: lvgl ?? null });
  };
  const num = (name) => (name in geom ? geom[name] : null);

  check('radius', spec.radius, num('face_r'));
  check('hands.hour.tip', spec.hands.hour.tip, num('hour_fwd'));
  check('hands.hour.width', spec.hands.hour.width, num('hour_w'));
  check('hands.minute.tip', spec.hands.minute.tip, num('min_fwd'));
  check('hands.minute.width', spec.hands.minute.width, num('min_w'));
  if (spec.hands.second) {
    check('hands.second.tip', spec.hands.second.tip, num('sec_fwd'));
    check('hands.second.tail', spec.hands.second.tail ?? 0, num('sec_back'));
    check('hands.second.width', spec.hands.second.width, num('sec_w'));
    check('hands.second.color', specColor(spec.hands.second.color ?? spec.face.ink, options), colors.hands.sec ?? null);
  }
  if (spec.ticks) {
    check('ticks.hour.outer', spec.ticks.hour.outer, num('hour_tick_outer'));
    check('ticks.hour.inner', spec.ticks.hour.inner, num('hour_tick_inner'));
    check('ticks.hour.width', spec.ticks.hour.width, num('hour_tick_w'));
    check('ticks.minute.outer', spec.ticks.minute.outer, num('min_tick_outer'));
    check('ticks.minute.inner', spec.ticks.minute.inner, num('min_tick_inner'));
    check('ticks.minute.width', spec.ticks.minute.width, num('min_tick_w'));
  }
  if (spec.dot) {
    const half = (name) => (num(name) === null ? null : num(name) / 2);
    check('dot.outer', spec.dot.outer, half('dot_outer'));
    check('dot.inner', spec.dot.inner, half('dot_inner'));
    check('dot.outerColor', specColor(spec.dot.outerColor ?? spec.face.ink, options), colors.dots.outer ?? null);
    check('dot.innerColor', specColor(spec.dot.innerColor ?? spec.face.background, options), colors.dots.inner ?? null);
  }
  check('face.background', specColor(spec.face.background, options), colors.face);
  check('face.ink', specColor(spec.face.ink, options), colors.hands.hour ?? null);
  return out;
}

// The React-versus-C mismatches known today, each with the reason it is not
// fixed here. May only SHRINK: resolving one means deleting its line in the
// same change that fixes a renderer. A mismatch not listed fails the gate; a
// listed field that no longer mismatches fails as stale. Which side is right
// is a palette decision for Nick (AGENTS.md: a red check on a deliberate
// design is a conversation, not a fix-forward).
export const PARITY_DRIFT_LEDGER = [
  { field: 'face.background', reason: 'React draws a black dial, the C a white one; the two renderers were never reconciled' },
  { field: 'face.ink', reason: 'React ink is white on black, C ink is black on white; follows the background decision' },
  { field: 'radius', reason: 'React fills the whole 1000 disc; the C draws a 460 face inside a black backdrop' },
  { field: 'ticks.hour.outer', reason: 'the C ticks sit 40 units inside the React ones because its face radius is 460' },
  { field: 'ticks.hour.inner', reason: 'the C ticks sit 40 units inside the React ones because its face radius is 460' },
  { field: 'ticks.minute.outer', reason: 'the C ticks sit 40 units inside the React ones because its face radius is 460' },
  { field: 'ticks.minute.inner', reason: 'the C ticks sit 40 units inside the React ones because its face radius is 460' },
];
