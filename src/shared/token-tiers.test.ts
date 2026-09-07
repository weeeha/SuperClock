// src/shared/token-tiers.test.ts
// The layer's contract, checked against the real stylesheet: every tier 2
// role carries both modes, and no tier 2 role holds a literal. Same shape as
// token-liveness.test.ts and part-contracts.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTiers, missingModes, tierViolations } from '../../scripts/lib/token-tiers.mjs';

const TOKENS = 'src/styles/tokens.css';

describe('token tiers', () => {
  const parsed = parseTiers(readFileSync(TOKENS, 'utf8'));

  it('declares ramps and roles (a narrowed parse must not report clean)', () => {
    expect(parsed.ramps.length, `${TOKENS} declares no tier 1 ramps`).toBeGreaterThan(0);
    expect(Object.keys(parsed.light).length, `${TOKENS} declares no tier 2 roles`).toBeGreaterThan(0);
  });

  it('every role carries a light and a dark value', () => {
    const missing = missingModes(parsed);
    expect(
      missing,
      `declared in one mode only in ${TOKENS}: ${missing.join(', ')}. A role with one mode leaves its surface unstyled in the other.`,
    ).toEqual([]);
  });

  it('no role holds a literal or a dangling ramp reference; every one resolves to a declared ramp', () => {
    const bad = tierViolations(parsed);
    expect(
      bad,
      `tier 2 role(s) in ${TOKENS} not resolving to a declared tier 1 ramp: ${bad.join(', ')}. Either the value is a literal (move it into a tier 1 ramp and point the role at it), or it is a var() reference naming a ramp tier 1 never declares (fix the typo, or add the missing ramp). Either way, the mode flip and any future rebrand cannot reach it as it stands.`,
    ).toEqual([]);
  });
});

// The eight face roles as src/index.css declared them before the token layer
// (commit prior to this work). A face that resolves to anything else is a
// pixel change on thirteen faces, which this sub-project forbids.
const FACE_BEFORE = {
  light: {
    '--face-bg': '#ffffff',
    '--face-ink': '#000000',
    '--face-ink-muted': '#52525b',
    '--face-tick': '#444444',
    '--face-plate': '#f1f1ef',
    '--face-dusk': '#8fa9c4',
    '--face-spent': '#e4e4e1',
    '--face-ghost': '#d9d9d4',
  },
  dark: {
    '--face-bg': '#000000',
    '--face-ink': '#ffffff',
    '--face-ink-muted': '#a1a1aa',
    '--face-tick': '#8a8a8a',
    '--face-plate': '#15171a',
    '--face-dusk': '#2b3d52',
    '--face-spent': '#111316',
    '--face-ghost': '#2c2f35',
  },
} as const;

describe('face values survive the move into the layer', () => {
  const css = readFileSync(TOKENS, 'utf8');
  const parsed = parseTiers(css);

  /** Resolve a role one hop through its ramp, which is all the layer allows. */
  function resolve(mode: 'light' | 'dark', role: string): string {
    const ref = parsed[mode][role];
    const ramp = /^var\((--[\w-]+)\)$/.exec(ref ?? '');
    if (!ramp) return ref ?? '(undeclared)';
    const decl = new RegExp(`^\\s*${ramp[1]}\\s*:\\s*([^;]+);`, 'm').exec(css);
    return decl ? decl[1].trim() : '(ramp missing)';
  }

  for (const mode of ['light', 'dark'] as const) {
    for (const [role, expected] of Object.entries(FACE_BEFORE[mode])) {
      it(`${mode}: ${role} still resolves to ${expected}`, () => {
        expect(
          resolve(mode, role),
          `${role} changed value in ${mode} mode. Thirteen faces and their contracts depend on it.`,
        ).toBe(expected);
      });
    }
  }

  it('src/index.css no longer declares a face role itself', () => {
    const entry = readFileSync('src/index.css', 'utf8');
    for (const role of Object.keys(FACE_BEFORE.light)) {
      expect(
        new RegExp(`^\\s*${role}\\s*:`, 'm').test(entry),
        `src/index.css still declares ${role}; the layer is the only place a role is written.`,
      ).toBe(false);
    }
    expect(entry).toContain("@import './styles/tokens.css'");
  });
});
