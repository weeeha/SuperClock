// Relative luminance and contrast ratio, WCAG 2.1. Fs-free like its siblings
// (token-tiers.mjs, token-rules.mjs): the real-tree gate owns reading
// tokens.css; this module only converts and compares colours.
//
// parseColor deliberately returns null rather than guessing: a value the
// gate cannot read must be reported as unreadable, never silently scored as
// a pass. It reads the two forms tier 2 actually uses (a six-digit hex, and
// the bare HSL triplet the admin-derived roles carry) and nothing else —
// in particular not the "255 255 255 / 0.15" scrim form, which is never an
// ink or a surface a text pair sits on.

/** @typedef {{ r: number, g: number, b: number }} Rgb */

/** @param {string} value @returns {Rgb | null} */
export function parseColor(value) {
  const v = value.trim();

  const hex = /^#([0-9a-fA-F]{6})$/.exec(v);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  const hsl = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec(v);
  if (!hsl) return null;
  const h = Number(hsl[1]) / 360;
  const s = Number(hsl[2]) / 100;
  const l = Number(hsl[3]) / 100;
  if (s === 0) {
    const g = Math.round(l * 255);
    return { r: g, g, b: g };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
  };
}

/** @param {Rgb} rgb @returns {number} */
export function relativeLuminance({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** @param {Rgb} a @param {Rgb} b @returns {number} */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
