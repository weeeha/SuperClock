import { describe, it, expect } from 'vitest';
import { SCHEMAS } from './schema-registry';
import { HAND_SHADOW_MODES, type HandShadowMode } from './hand-shadow';

// The per-face default is a design decision (agent log, 2026-09-09), so it
// is data here, and a face gains the key only by landing a row. The eight
// faces not listed have no decided default and carry no key: shipping
// `none` on them would be a decision made by omission.
const DECIDED: Record<string, HandShadowMode> = {
  floral: 'cast',
  productivity: 'cast',
  'complications-light': 'cast',
  analog: 'none',
  'complications-dark': 'none',
};

const faceIds = Object.keys(SCHEMAS)
  .filter((id) => id.startsWith('face.'))
  .map((id) => id.slice('face.'.length));

describe('hand shadow option', () => {
  it('is the three-way enum the decision named', () => {
    expect(HAND_SHADOW_MODES).toEqual(['none', 'cast', 'soft']);
  });

  it('every decided face carries handShadow at its decided default, accepts every mode, and describes it for the admin', () => {
    for (const [id, mode] of Object.entries(DECIDED)) {
      const entry = SCHEMAS[`face.${id}`];
      expect(entry, `face.${id} is not registered`).toBeDefined();
      const parsed = entry.schema.parse({}) as Record<string, unknown>;
      expect(parsed.handShadow, `face.${id}: default`).toBe(mode);
      for (const m of HAND_SHADOW_MODES) {
        expect(entry.schema.safeParse({ handShadow: m }).success, `face.${id} rejects ${m}`).toBe(true);
      }
      expect(entry.schema.safeParse({ handShadow: 'glow' }).success, `face.${id} accepts an unknown mode`).toBe(false);
      expect(entry.meta.handShadow?.description, `face.${id}: meta lacks a description`).toBeTruthy();
    }
  });

  it('no other face carries handShadow: a default is a decision, not a fallthrough', () => {
    for (const id of faceIds) {
      if (id in DECIDED) continue;
      const parsed = SCHEMAS[`face.${id}`].schema.parse({}) as Record<string, unknown>;
      expect(
        'handShadow' in parsed,
        `face.${id} carries handShadow without a decided default; add its row here with the decision`,
      ).toBe(false);
    }
  });
});
