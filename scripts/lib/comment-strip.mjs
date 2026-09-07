// Comment-and-string-aware source stripping, shared by scripts/rulecheck.mjs
// (a runner: node:fs at module scope, JS/TSX sources) and
// scripts/lib/token-liveness.mjs (a pure predicate: no node:fs anywhere,
// CSS and JS/TSX sources both). Lives here, under scripts/lib, so a lib can
// depend on this logic without a lib importing a runner: the same shape
// every other scripts/lib module already has (token-rules.mjs,
// token-tiers.mjs, token-liveness.mjs, lvgl-parity.mjs, parts-index.mjs,
// contrast.mjs, all fs-free, so vitest can drive every predicate with
// fixtures while the runners above them own globbing and exit codes). This
// module touches no files itself, only strings.
//
// One state machine, `strip`, runs both dialects. `stripComments` and
// `stripCssComments` below are the public surface, each pinning the
// machine's `css` switch so a caller never has to know it exists or pass
// it. Kept as two named exports, not one function taking an options bag:
// every existing call site already spells the dialect it wants by the name
// it imports (scripts/rulecheck.mjs, scripts/lib/token-liveness.mjs, and
// the tests of both), so a reader sees "CSS" or does not, right at the
// call, with nothing to look up.
//
// JS/TSX dialect (stripComments): blanks line and block comments, tracks
// single-quote, double-quote and backtick string literals (a
// backslash-escaped character survives untouched inside one) so
// comment-like text inside a string is never touched, and preserves both
// length and line breaks so a caller's reported line numbers still point
// at the real line. A slash glued to a word character is JSX prose or a
// URL, not a comment opener.
//
// CSS dialect (stripCssComments): only the block form. CSS has no line
// comment, so an unquoted, protocol-relative url(//cdn.example.com/x.png)
// is ordinary CSS text, not a comment opener. Only single and double
// quotes are string delimiters (CSS strings never use a backtick), and
// there is no glued check, since CSS has nothing for it to guard against.
//
// Provenance: the JS/TSX form was harvested from design-system-rebuild
// scripts/rulecheck.mjs (via the ds-architecture starter kit) under the
// "port, don't rewrite" rule. The CSS form was adapted from it for
// SuperClock, same technique, narrowed to the grammar CSS actually has.

const WORD_BEFORE_SLASH = /[A-Za-z0-9_$]/;

function strip(source, css) {
  const out = [];
  let mode = 'code'; // 'code' | 'line' | 'block' | "'" | '"' | '`'
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    if (mode === 'code') {
      const glued = !css && WORD_BEFORE_SLASH.test(source[i - 1] ?? '');
      if (!css && c === '/' && next === '/' && !glued) {
        mode = 'line';
        out.push('  ');
        i++;
      } else if (c === '/' && next === '*' && !glued) {
        mode = 'block';
        out.push('  ');
        i++;
      } else {
        if (c === "'" || c === '"' || (!css && c === '`')) mode = c;
        out.push(c);
      }
      continue;
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code';
        out.push('\n');
      } else out.push(' ');
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && next === '/') {
        mode = 'code';
        out.push('  ');
        i++;
      } else out.push(c === '\n' ? '\n' : ' ');
      continue;
    }
    if (c === '\\') {
      out.push(c, next ?? '');
      i++;
      continue;
    }
    if (c === mode) mode = 'code';
    out.push(c);
  }
  return out.join('');
}

// Blank line and block comments in a JS/TSX source, keep string contents
// intact, preserve length and line breaks. See the JS/TSX dialect note
// above for exactly what counts as a comment opener.
export function stripComments(source) {
  return strip(source, false);
}

// Blank block comments in a CSS source; CSS has no line-comment form. See
// the CSS dialect note above for exactly what counts as a comment opener.
export function stripCssComments(cssText) {
  return strip(cssText, true);
}
