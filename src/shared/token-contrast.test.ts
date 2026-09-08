// Contrast at the token level: each ink role against the surface it is
// designated for, in both modes. This is not a rendered check, and R11's
// record says so: a screen can still fail with compliant tokens. What it
// does catch is a role pair that could never pass, in either mode, before
// anyone renders it.
//
// PAIRS is derived, not hand-kept, for the half that can be: every generic
// ink role (--ink, --ink-muted) crossed with every --surface-* role found
// in the parsed tier 2 roles, via derivedPairs below. A surface role added
// later is in that cross product the moment it is declared, with no edit
// here. The rest is HAND_PAIRS, kept hand-written because no single naming
// rule recovers the right surface from the ink role's name: --face-ink
// alone pairs with two different surfaces (--face-bg and --face-plate),
// --face-ink-muted only one of them, and --sheet-ink's surface,
// --color-sheet, is not even a tier 2 role in this file: it is a literal in
// src/index.css's @theme block. Three properties keep the combined list
// honest:
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
//      it;
//   3. every --surface-* role appears as the surface side of a pair against
//      the generic ink roles (also asserted below), and no tier 2 role uses
//      a foreground-style name (-fg, -foreground) instead of the -ink
//      convention property 2 depends on to find it. A reviewer proved both
//      gaps before this fix: a --surface-* role at 1.1:1 against --ink
//      passed because the surface side was a hand-kept array that never
//      grew with it, and a role named --label-fg passed because nothing
//      required a foreground role to be named with "ink" in the first
//      place.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTiers } from '../../scripts/lib/token-tiers.mjs';
import type { ParsedTiers } from '../../scripts/lib/token-tiers.mjs';
import { parseColor, contrastRatio, resolveThemeValue } from '../../scripts/lib/contrast.mjs';

const TOKENS = 'src/styles/tokens.css';
const KIOSK_THEME = 'src/index.css';
const AA = 4.5;

// The two roles that pair against every surface rather than one of their
// own: text-on-any-chrome-surface, not text-on-one-specific-thing. Every
// other ink-ish role is namespaced to a surface (or two) that only a human
// can name correctly; see HAND_PAIRS below.
const GENERIC_INK_ROLES = ['--ink', '--ink-muted'];

// Pairs a name cannot recover on its own. --face-* pairs are the actual,
// current SVG consumers (AnalogClock and its siblings paint --face-ink and
// --face-ink-muted directly over --face-bg and --face-plate rects);
// --brand-ink/--brand and --status-warn-ink/--status-warn are the roles'
// documented intent (src/styles/tokens.css's own comment, and the
// --color-* aliasing task-3 scaffolded before its admin rollout was
// deferred to sub-project 2) ahead of any real consumer, since nothing in
// src/admin reads a tier 2 role yet. --status-danger and --status-ok have
// no dedicated ink role of their own yet (the task-3 scaffold reused --ink
// for danger and had no foreground at all for ok), so neither appears
// here; see the report. --sheet-ink is the proof-surface task's own
// addition (the quick-settings sheet): it is the real, current consumer
// (bg-fill-knob's sibling), checked directly against --color-sheet, the
// kiosk @theme token declared in src/index.css that the sheet actually
// paints through bg-sheet (resolveThemeValue below reads the literal
// straight out of that block; there is no tier 2 mirror of it). --fill-knob
// is deliberately absent from both PAIRS halves: an opaque mark on the
// translucent fill track has no single surface a token-level pair could
// check it against, so it was named outside the --*ink* family instead of
// added here unchecked.
const HAND_PAIRS: Array<[string, string]> = [
  ['--brand-ink', '--brand'],
  ['--status-warn-ink', '--status-warn'],
  ['--face-ink', '--face-bg'],
  ['--face-ink-muted', '--face-bg'],
  ['--face-ink', '--face-plate'],
  ['--sheet-ink', '--color-sheet'],
];

/** Every --surface-* role declared in tier 2, crossed with both generic ink
 *  roles. Reads the role list itself rather than a literal array of surface
 *  names, so a --surface-* role declared later is in this cross product
 *  before anyone writes a test for it (the spec's Risks section: "derive
 *  its pairs from the role list ... so a role added later arrives already
 *  checked"). */
function derivedPairs(parsed: ParsedTiers): Array<[string, string]> {
  const surfaceRoles = Object.keys(parsed.light).filter((role) => role.startsWith('--surface-'));
  const pairs: Array<[string, string]> = [];
  for (const ink of GENERIC_INK_ROLES) {
    for (const surface of surfaceRoles) pairs.push([ink, surface]);
  }
  return pairs;
}

describe('token contrast', () => {
  const css = readFileSync(TOKENS, 'utf8');
  const parsed = parseTiers(css);
  const kioskTheme = readFileSync(KIOSK_THEME, 'utf8');
  const PAIRS: Array<[string, string]> = [...derivedPairs(parsed), ...HAND_PAIRS];

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
        `Add a pair naming the surface it is designated for (HAND_PAIRS if the surface cannot be derived from the name).`,
    ).toEqual([]);
  });

  it('every --surface-* role is crossed with the generic ink roles, so a role added later cannot escape the gate', () => {
    // Recomputed independently of derivedPairs (same source data, a
    // separate expression) so a regression back to a hand-kept surface
    // list inside derivedPairs itself still fails this assertion, rather
    // than this being a tautology against derivedPairs's own output. This
    // is the half the reviewer proved missing: a --surface-* role at
    // 1.1:1 against --ink passed clean before this fix, because the
    // surface side was a hand-kept array nothing required to grow with it.
    const surfaceRoles = Object.keys(parsed.light).filter((role) => role.startsWith('--surface-'));
    const pairedSurfaces = new Set(
      PAIRS.filter(([ink]) => GENERIC_INK_ROLES.includes(ink)).map(([, surface]) => surface),
    );
    const missing = surfaceRoles.filter((role) => !pairedSurfaces.has(role));
    expect(
      missing,
      `--surface-* role(s) declared in ${TOKENS} never paired against the generic ink roles (${GENERIC_INK_ROLES.join(', ')}): ${missing.join(', ')}. ` +
        `derivedPairs reads --surface-* names straight from the parsed roles; if this fails, that derivation itself regressed to a hand-kept list.`,
    ).toEqual([]);
  });

  it('no tier 2 role is named like a foreground colour outside the --*ink* convention', () => {
    // The completeness check above only ever looks at roles whose name
    // already contains "ink"; a role that means the same thing under a
    // different word (shadcn's own -foreground, or a short -fg) would pass
    // it by never being asked about. A reviewer proved this with
    // --label-fg: the naming convention itself was unenforced, which is
    // what makes the ink-ish check above complete rather than merely
    // consistent with itself.
    const NON_INK_FOREGROUND_RE = /-(?:fg|foreground)$/;
    const offenders = Object.keys(parsed.light).filter((role) => NON_INK_FOREGROUND_RE.test(role));
    expect(
      offenders,
      `role(s) declared in ${TOKENS} named like a foreground colour without the --*ink* convention: ${offenders.join(', ')}. ` +
        `Tier 3's shadcn vocabulary (src/admin/index.css) is where -foreground belongs; tier 2 roles here use -ink so the check above can find them. Rename to end in -ink.`,
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
