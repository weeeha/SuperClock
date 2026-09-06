// R10 as a detector: the face that claims LVGL parity is diffed, number by
// number and colour by colour, against slow-native/src/clock_face.c. Known
// drift lives in PARITY_DRIFT_LEDGER with a reason; anything else is red.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { faceMetaSchema } from './part-meta';
import { SCHEMAS } from './schema-registry';
import { FACES } from './face-registry';
import { parseGeom, parseColors, compareToSpec, PARITY_DRIFT_LEDGER } from '../../scripts/lib/lvgl-parity.mjs';

const parityFaces = readdirSync('src/apps/clock')
  .filter((f) => f.endsWith('.meta.json'))
  .map((f) => faceMetaSchema.parse(JSON.parse(readFileSync(`src/apps/clock/${f}`, 'utf8'))))
  .filter((m) => m.parity.lvgl !== null);

describe('React ↔ LVGL parity', () => {
  it('exactly one face claims the C file today (the parser reads one initializer)', () => {
    expect(parityFaces.map((m) => m.id)).toEqual(['analog']);
  });

  for (const meta of parityFaces) {
    // parityFaces is already filtered to parity.lvgl !== null, but .filter()
    // does not narrow the array's element type, so meta.parity.lvgl is still
    // string | null here. Recheck the raw path rather than asserting it away.
    if (meta.parity.lvgl === null) continue;
    const cSource = readFileSync(meta.parity.lvgl, 'utf8');
    const { geom, missing } = parseGeom(cSource);
    const colors = parseColors(cSource);
    const schemaId = FACES.find((f) => f.id === meta.id)?.configSchemaId;
    const defaults = schemaId ? SCHEMAS[schemaId].schema.parse({}) : {};
    const mismatches = compareToSpec(geom, colors, meta.spec, defaults);
    const ledgered = new Set(PARITY_DRIFT_LEDGER.map((e) => e.field));

    it(`${meta.id}: the C initializer is fully readable (a moved initializer must not read as clean)`, () => {
      expect(missing, `geom_t fields not found in ${meta.parity.lvgl}: ${missing.join(', ')}`).toEqual([]);
    });

    it(`${meta.id}: every React-versus-C mismatch is in PARITY_DRIFT_LEDGER with a reason`, () => {
      const silent = mismatches.filter((m) => !ledgered.has(m.field));
      expect(
        silent,
        `unledgered drift: ${silent.map((m) => `${m.field} (react ${m.react}, lvgl ${m.lvgl})`).join('; ')}. Add a ledger entry with the reason, or reconcile the renderer that is wrong.`,
      ).toEqual([]);
    });

    it(`${meta.id}: no ledger entry is stale (the list may only shrink)`, () => {
      const fields = new Set(mismatches.map((m) => m.field));
      const stale = PARITY_DRIFT_LEDGER.filter((e) => !fields.has(e.field)).map((e) => e.field);
      expect(stale, `ledger entries that no longer mismatch: ${stale.join(', ')}. Delete them.`).toEqual([]);
    });
  }
});
