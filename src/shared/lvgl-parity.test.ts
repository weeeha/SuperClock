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
    // Same reasoning for spec: faceMetaSchema's superRefine requires a face
    // claiming parity to carry spec, but that cross-field rule is not
    // reflected in FaceMeta's type, where spec stays optional. Declaring a
    // new const from the already-narrowed expression keeps the narrow type
    // as its own into the it() callbacks below; re-reading meta.spec inside
    // one would not (AnalogClock.tsx's spec.ticks/spec.dot pattern).
    if (!meta.spec) continue;
    const spec = meta.spec;
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

    // parseColors returns null for a colour it cannot parse, and
    // compareToSpec turns that into a mismatch against null — which, on the
    // four fields already carrying a ledgered mismatch (face.background,
    // face.ink, face.ink.tick, face.ink.minute), reads as the *known* drift
    // instead of a broken parse. This check is independent of the ledger:
    // every colour call must resolve to a string, whether or not the
    // resolved value goes on to match the spec.
    it(`${meta.id}: every C colour is readable (an unreadable colour must not read as ledgered drift)`, () => {
      const unread = Object.entries({ face: colors.face, tick: colors.tick, ...colors.hands, ...colors.dots })
        .filter(([, v]) => v == null).map(([k]) => k);
      expect(unread, `colour calls not parsed in ${meta.parity.lvgl}: ${unread.join(', ')}`).toEqual([]);
    });

    // The check above spreads colors.hands/colors.dots, which only surfaces
    // a key that is present with a null value (the colour argument did not
    // parse). Both objects are built by matching call sites in the C source
    // (make_hand/make_dot), so a renamed or deleted call leaves its key
    // absent instead — invisible to a spread. This checks the key set
    // itself, the same failure mode parseGeom's `missing` already covers
    // for geometry fields.
    it(`${meta.id}: every make_hand/make_dot call the spec expects has a match in the C source (a renamed or deleted call leaves the key absent, not null)`, () => {
      const expectedHands = ['hour', 'min', ...(spec.hands.second ? ['sec'] : [])];
      const missingHands = expectedHands.filter((k) => !(k in colors.hands));
      const expectedDots = spec.dot ? ['outer', 'inner'] : [];
      const missingDots = expectedDots.filter((k) => !(k in colors.dots));
      const missingCalls = [...missingHands.map((k) => `make_hand(${k})`), ...missingDots.map((k) => `make_dot(${k})`)];
      expect(missingCalls, `no call found in ${meta.parity.lvgl} for: ${missingCalls.join(', ')}`).toEqual([]);
    });

    // spec.ticks and spec.dot are each nullable, and compareToSpec treats
    // null as "this face draws none", skipping the six tick checks or the
    // four dot checks with no complaint. That is correct for a face that
    // genuinely has neither. It is silent data loss for a parity face whose
    // C twin still draws them: nulling ticks is already caught, because the
    // four ticks.* ledger entries above go stale and the "no ledger entry is
    // stale" test below fails. Nulling dot is not: no ledger entry
    // references a dot field, so its four comparisons just stop happening,
    // green. Same shape as Finding 1: a gap reads as clean instead of as
    // untested. Mirrors the guard AnalogClock.tsx itself takes at load time
    // (AnalogClock.tsx:18-20).
    it(`${meta.id}: carries ticks and dot (a null section stops being compared instead of failing)`, () => {
      expect(
        spec.ticks,
        `${meta.id}'s spec has no ticks while claiming LVGL parity against ${meta.parity.lvgl}; compareToSpec then silently skips all six tick comparisons. Restore ticks, or drop the parity claim if the face truly has none.`,
      ).not.toBeNull();
      expect(
        spec.dot,
        `${meta.id}'s spec has no dot while claiming LVGL parity against ${meta.parity.lvgl}; compareToSpec then silently skips all four dot comparisons. Restore dot, or drop the parity claim if the face truly has none.`,
      ).not.toBeNull();
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
