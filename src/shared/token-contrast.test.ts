// Contrast at the token level: each ink role against the surface it is
// designated for, in both modes. This is not a rendered check, and R11's
// record says so: a screen can still fail with compliant tokens. What it
// does catch is a role pair that could never pass, in either mode, before
// anyone renders it.
//
// PAIRS is a hand list, corrected against the real role names in
// src/styles/tokens.css rather than trusted from the plan that first wrote
// it (role names had already stabilised on --ink, --brand-ink and the
// --status-* family by the time this task landed, so nothing needed
// renaming; see the report). Two properties keep the list honest:
//
//   1. every pair's two values must actually resolve to a colour this gate
//      can read, or the pair is reported unreadable and fails: it is
//      never silently skipped and scored as a pass. A name resolves
//      against one of two sources: a tier 2 role in src/styles/tokens.css
//      (through its ramp), or a literal declared directly inside
//      src/index.css's @theme block, the kiosk's own token layer outside
//      the tier system: --sheet-ink's surface, --color-sheet, is the
//      second kind;
//   2. every tier 2 role whose name marks it as an ink (the --*ink* family:
//      --ink, --ink-muted, --brand-ink, --status-warn-ink, --face-ink,
//      --face-ink-muted today) appears as the ink side of at least one
//      pair, asserted directly below, so a role added later cannot
//      silently escape the gate the way an unchecked hand list would let
//      it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTiers } from '../../scripts/lib/token-tiers.mjs';
import { parseColor, contrastRatio, resolveThemeValue } from '../../scripts/lib/contrast.mjs';

const TOKENS = 'src/styles/tokens.css';
const KIOSK_THEME = 'src/index.css';
const AA = 4.5;

// Ink against the surface it is designated for. --face-* pairs are the
// actual, current SVG consumers (AnalogClock and its siblings paint
// --face-ink and --face-ink-muted directly over --face-bg and --face-plate
// rects); the chrome/admin pairs are the roles' documented intent
// (src/styles/tokens.css's own comment, and the --color-* aliasing task-3
// scaffolded before its admin rollout was deferred to sub-project 2) ahead
// of any real consumer, since nothing in src/admin reads a tier 2 role yet.
// --ink and --ink-muted are crossed with every --surface-* role that
// exists, so neither can pass by only ever being asked about its easiest
// surface. --status-danger and --status-ok have no dedicated ink role of
// their own yet (the task-3 scaffold reused --ink for danger and had no
// foreground at all for ok), so neither appears here; see the report.
// --sheet-ink is the proof-surface task's own addition (the quick-settings
// sheet): it is the real, current consumer (bg-fill-knob's sibling), and
// it is checked directly against --color-sheet, the kiosk @theme token
// declared in src/index.css that the sheet actually paints through
// bg-sheet (resolveThemeValue below reads the literal straight out of
// that block; there is no tier 2 mirror of it). --fill-knob is
// deliberately not in this list: an opaque mark on the translucent fill
// track has no single surface a token-level pair could check it against,
// so it was named outside the --*ink* family instead of added here
// unchecked.
const PAIRS: Array<[string, string]> = [
  ['--ink', '--surface-ground'],
  ['--ink', '--surface-card'],
  ['--ink', '--surface-sheet'],
  ['--ink', '--surface-popover'],
  ['--ink-muted', '--surface-ground'],
  ['--ink-muted', '--surface-card'],
  ['--ink-muted', '--surface-sheet'],
  ['--ink-muted', '--surface-popover'],
  ['--brand-ink', '--brand'],
  ['--status-warn-ink', '--status-warn'],
  ['--face-ink', '--face-bg'],
  ['--face-ink-muted', '--face-bg'],
  ['--face-ink', '--face-plate'],
  ['--sheet-ink', '--color-sheet'],
];

describe('token contrast', () => {
  const css = readFileSync(TOKENS, 'utf8');
  const parsed = parseTiers(css);
  const kioskTheme = readFileSync(KIOSK_THEME, 'utf8');

  /** True when `name` is declared somewhere this gate knows how to read: a
   *  tier 2 role in TOKENS, or a literal inside KIOSK_THEME's @theme
   *  block. Neither counts as existing on its own; a name declared in
   *  neither place is not a role this gate can check anything against. */
  function declared(name: string): boolean {
    return parsed.light[name] !== undefined || resolveThemeValue(kioskTheme, name) !== null;
  }

  /** A tier 2 role resolves through its ramp, one hop, inside TOKENS. A
   *  name that is not a tier 2 role at all falls back to KIOSK_THEME's
   *  @theme block, where --color-sheet lives as a plain hex with no ramp
   *  indirection. A name found in neither place returns null, same as an
   *  unparseable value: the caller reports it unreadable, it never reads
   *  as "nothing to check". */
  function value(mode: 'light' | 'dark', role: string): string | null {
    const ref = parsed[mode][role];
    if (ref !== undefined) {
      const ramp = /^var\((--[\w-]+)\)$/.exec(ref);
      if (!ramp) return null;
      const decl = new RegExp(`^\\s*${ramp[1]}\\s*:\\s*([^;]+);`, 'm').exec(css);
      return decl ? decl[1].trim() : null;
    }
    return resolveThemeValue(kioskTheme, role);
  }

  it('every pair names roles that exist', () => {
    for (const [ink, surface] of PAIRS) {
      expect(
        declared(ink),
        `${ink} is not a declared role (tier 2 in ${TOKENS}, or a kiosk @theme token in ${KIOSK_THEME})`,
      ).toBe(true);
      expect(
        declared(surface),
        `${surface} is not a declared role (tier 2 in ${TOKENS}, or a kiosk @theme token in ${KIOSK_THEME})`,
      ).toBe(true);
    }
  });

  it('every ink-ish role appears in at least one pair, so a role added later cannot escape the gate', () => {
    const inkRoles = Object.keys(parsed.light).filter((role) => role.includes('ink'));
    const covered = new Set(PAIRS.map(([ink]) => ink));
    const missing = inkRoles.filter((role) => !covered.has(role));
    expect(
      missing,
      `ink-ish role(s) declared in ${TOKENS} with no pair in PAIRS: ${missing.join(', ')}. ` +
        `Add a pair naming the surface it is designated for.`,
    ).toEqual([]);
  });

  for (const mode of ['light', 'dark'] as const) {
    it(`${mode}: every ink and surface pair is readable, and every value is parseable`, () => {
      const unreadable: string[] = [];
      const failing: string[] = [];
      for (const [ink, surface] of PAIRS) {
        const a = value(mode, ink);
        const b = value(mode, surface);
        const ca = a === null ? null : parseColor(a);
        const cb = b === null ? null : parseColor(b);
        if (!ca || !cb) {
          unreadable.push(`${ink} on ${surface}`);
          continue;
        }
        const ratio = contrastRatio(ca, cb);
        if (ratio < AA) failing.push(`${ink} on ${surface} = ${ratio.toFixed(2)}:1`);
      }
      expect(
        unreadable,
        `values the gate could not parse in ${mode}: ${unreadable.join(', ')}. An unparseable value must not read as a pass.`,
      ).toEqual([]);
      expect(
        failing,
        `below ${AA}:1 in ${mode} mode: ${failing.join('; ')}. Move up the ink ramp or lighten the surface; never add a one-off darker value.`,
      ).toEqual([]);
    });
  }
});
