// The kiosk's own design ceilings.
//
// `src/apps` sits outside SYS-1 on purpose: the token gate forbids raw hex in
// src/admin and src/core, but a face's palette is content, so apps and faces
// were left free. The cost of that freedom is unbounded: as of 2026-09-07 the
// kiosk apps and faces between them use 61 distinct font sizes against
// unslop's budget of 7, and 121 distinct raw colours with no palette behind
// them. That is the mechanical reason the surfaces read as unfinished — every
// app invented its own scale.
//
// Fixing that is a design pass per app, not a sweep, so this file does the one
// thing that is safe to do now: it freezes both numbers. They may only shrink.
// A design pass lowers the ceiling as it lands; nothing may raise it.
//
// fs-free by design, like token-liveness.mjs and asset-liveness.mjs beside it:
// the real-tree gate in src/shared/design-ratchet.test.ts walks the files and
// hands the text here.

// Frozen 2026-09-07 from the tree. Lower these as design passes land; the gate
// fails if a count exceeds its ceiling, and fails as stale if it drops below
// without the ceiling following it down.
export const CEILINGS = {
  fontSizes: 61,
  colours: 121,
};

// Files whose colours are data rather than design, so they are not counted.
export const NOT_DESIGN = [
  'src/apps/claude-usage/sprites.ts', // scraped 20x20 sprite palettes
];

const FONT_SIZE = /text-\[[^\]]+\]|text-(?:xs|sm|base|lg|xl|[2-9]xl)\b|fontSize=\{?["']?[0-9.]+/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

export function extractFontSizes(source) {
  return new Set((source.match(FONT_SIZE) ?? []).map((s) => s.trim()));
}

export function extractColours(source) {
  return new Set((source.match(HEX) ?? []).map((s) => s.toLowerCase()));
}

/** #rgb or #rrggbb → {h, s, l} in degrees and percent, or null if unparseable. */
export function hexToHsl(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let hue = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(hue * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// COL-6 bans indigo, violet and purple, but its detector only matches Tailwind
// utility class names (`bg-indigo-500`). Every occurrence in this repo is
// written as raw hex inside a face, so the rule has never once fired on them.
// This computes the hue instead of reading the name, which is the only way to
// catch a colour nobody spelled.
export function isBannedHue(hex) {
  const c = hexToHsl(hex);
  if (!c) return false;
  return c.h >= 235 && c.h <= 300 && c.s >= 25 && c.l >= 20 && c.l <= 85;
}

// Banned-hue colours already on the tree, per file. Shrink-only.
//
// Seven of the eight are inside faces, and AGENTS.md is explicit that a face's
// look is the product: changing a palette to turn a check green is forbidden,
// and the decision is Nick's. Floral is an artistic face whose whole subject is
// flowers, so its violets may well be the right answer and COL-6 may simply
// not be about artistic faces — that question is open, not settled here. The
// eighth is a weather condition colour, which is chrome, and COL-6 does mean
// that one.
export const BANNED_HUE_LEDGER = {
  // #f0abfc #c084fc #6366f1 #a78bfa #e879f9 — the petal palette.
  'src/apps/clock/FloralClock.tsx': 5,
  // #7c3aed on a data tile.
  'src/apps/clock/ComplicationsDark.tsx': 1,
  // #a855f7 on a progress quantity.
  'src/apps/clock/ProductivityClock.tsx': 1,
  // #a05ad0, a condition colour — the only one outside a face, and the only
  // one a design pass will reach on its own.
  'src/apps/weather/weather-utils.ts': 1,
};
