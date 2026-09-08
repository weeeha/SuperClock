// Direct fixture tests for scripts/lib/comment-strip.mjs, the pure,
// fs-free module both scripts/rulecheck.mjs and
// scripts/lib/token-liveness.mjs import stripComments and stripCssComments
// from (see each file's own header for why the sharing exists). This file
// tests the two strip functions' own output: given a fixture, is the
// comment blanked, is the string literal untouched, are length and line
// breaks preserved. It does not test what a caller does with the stripped
// text (findReaders, auditLiveness): scripts/lib/token-liveness.test.ts
// keeps that coverage, composed the same way the real gate
// (src/shared/token-liveness.test.ts) uses it. scripts/lib/rulecheck.test.ts
// keeps its own direct stripComments test too, unedited: this file adds
// the same shape here rather than moving it, so rulecheck.test.ts's own
// fixtures stay exactly as they were.

import { describe, it, expect } from 'vitest';
import { stripComments, stripCssComments } from './comment-strip.mjs';

describe('stripComments: general shape (JS/TSX)', () => {
  it('blanks line and block comments, keeps strings, preserves length and line breaks', () => {
    const fixture = [
      `const url = "https://x.dev/a//b" // trailing note`,
      `/* block`,
      `   spanning */ const s = 'it\\'s "/*" fine'`,
      `<Code>image/*</Code>`,
      'const t = `tick // not a comment`',
    ].join('\n');
    const out = stripComments(fixture);
    expect(out.length).toBe(fixture.length);
    expect(out.split('\n').length).toBe(fixture.split('\n').length);
    expect(out).not.toContain('trailing note');
    expect(out).not.toContain('block');
    expect(out).toContain('https://x.dev/a//b');
    expect(out).toContain('tick // not a comment');
    expect(out).toContain('image/*');
  });
});

describe('stripComments: the four required fixture shapes (JS/TSX)', () => {
  it('a var() inside a line comment does not survive', () => {
    const out = stripComments('// var(--face-ink) explained the old approach\nconst x = 1;');
    expect(out).not.toContain('var(--face-ink)');
    expect(out).toContain('const x = 1;');
  });

  it('a var() inside a block comment does not survive', () => {
    const out = stripComments('/* var(--face-ink) was read here before the refactor */\nconst x = 1;');
    expect(out).not.toContain('var(--face-ink)');
    expect(out).toContain('const x = 1;');
  });

  it('a real read on the same line as a trailing comment still survives', () => {
    const out = stripComments('<circle fill="var(--face-ink)" /> // the face outline');
    expect(out).toContain('var(--face-ink)');
    expect(out).not.toContain('the face outline');
  });

  it('a comment marker inside a string literal does not eat real code', () => {
    const out = stripComments(
      'const note = "not a real /* comment */ marker";\nconst ink = \'var(--face-ink)\';',
    );
    expect(out).toContain('not a real /* comment */ marker');
    expect(out).toContain('var(--face-ink)');
  });
});

describe('stripCssComments: CSS has only the block comment form', () => {
  it('blanks a block comment, keeps declarations, preserves length and line breaks', () => {
    const fixture = ['/* Chrome scrims, one per role */', ':root {', '  --scrim-knob: 0 0 0;', '}'].join('\n');
    const out = stripCssComments(fixture);
    expect(out.length).toBe(fixture.length);
    expect(out.split('\n').length).toBe(fixture.split('\n').length);
    expect(out).not.toContain('Chrome scrims');
    expect(out).toContain('--scrim-knob: 0 0 0;');
  });

  it('blanks a token mention on an interior line of a multi-line block comment (the tokens.css:57 shape)', () => {
    const fixture = [
      '/* plus one opaque black (--scrim-knob) for the toggle',
      '   knob: not a translucent overlay */',
      '--scrim-knob: 0 0 0;',
    ].join('\n');
    const out = stripCssComments(fixture);
    expect(out).not.toContain('(--scrim-knob)');
    expect(out).toContain('--scrim-knob: 0 0 0;');
  });

  it('does not treat // as a comment opener: CSS has no line-comment form, so a protocol-relative url survives untouched', () => {
    const fixture = 'background: url(//cdn.example.com/img.png); color: var(--face-ink);';
    expect(stripCssComments(fixture)).toBe(fixture);
  });

  it('a real read on the same line as a trailing block comment still survives', () => {
    const out = stripCssComments('.x {\n  background: var(--face-ink); /* the face plate */\n}');
    expect(out).toContain('var(--face-ink)');
    expect(out).not.toContain('the face plate');
  });

  it('keeps a string literal intact even when it contains comment-like text', () => {
    const fixture = 'content: "/* not a comment */ still here"; color: var(--face-ink);';
    expect(stripCssComments(fixture)).toBe(fixture);
  });
});
