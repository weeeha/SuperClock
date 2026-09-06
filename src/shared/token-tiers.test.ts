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

  it('no role holds a literal; every one points at a ramp', () => {
    const bad = tierViolations(parsed);
    expect(
      bad,
      `tier 2 roles holding a literal in ${TOKENS}: ${bad.join(', ')}. Move the value into a tier 1 ramp and point the role at it, or the mode flip and any future rebrand cannot reach it.`,
    ).toEqual([]);
  });
});
