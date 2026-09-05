// Schema snapshot gate. Config schemas are the contract between what the
// admin writes into fleet.json and what every kiosk reads back, and every
// consumer's fallback is `schema.parse({})`: rename a field or drop an enum
// value and a user's stored config silently reverts to defaults on-glass.
// This suite pins the committed JSON Schema snapshot to the live zod schemas
// and classifies each diff the way a versioned component library would,
// breaking / minor / patch (lineage: Nathan Curtis, spec-driven UI component
// development). Refresh with `npm run snapshot:schemas`; it refuses breaking
// changes until FLEET_SCHEMA_VERSION is bumped, i.e. a fleet migration exists.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  toSnapshotSchema,
  classifySchemaChanges,
  buildSchemaSnapshot,
  serializeSnapshot,
  formatSchemaChanges,
  snapshotRefreshVerdict,
  SNAPSHOT_PATH,
  type SchemaSnapshot,
} from './schema-snapshot';
import { SCHEMAS } from './schema-registry';
import { FLEET_SCHEMA_VERSION } from './device-config-schema';

const obj = (properties: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: 'object',
  properties,
  ...extra,
});

describe('toSnapshotSchema', () => {
  it('emits input-mode JSON Schema: defaulted fields stay optional, $schema is stripped', () => {
    const s = toSnapshotSchema(z.object({ a: z.enum(['x', 'y']).default('x') }));
    expect(s).toEqual(obj({ a: { default: 'x', enum: ['x', 'y'], type: 'string' } }));
  });

  it('canonicalizes key order so reordering zod fields is not a change', () => {
    const one = toSnapshotSchema(z.object({ a: z.string().default(''), b: z.boolean().default(true) }));
    const two = toSnapshotSchema(z.object({ b: z.boolean().default(true), a: z.string().default('') }));
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
  });
});

describe('classifySchemaChanges', () => {
  it('reports nothing when schemas are identical', () => {
    const s = { 'app.a': obj({ a: { type: 'string', default: '' } }) };
    expect(classifySchemaChanges(s, structuredClone(s))).toEqual([]);
  });

  it('a removed property is breaking (stored values are stripped silently)', () => {
    const before = { 'app.a': obj({ a: { type: 'string' }, b: { type: 'string' } }) };
    const after = { 'app.a': obj({ a: { type: 'string' } }) };
    expect(classifySchemaChanges(before, after)).toEqual([
      { kind: 'breaking', schemaId: 'app.a', path: 'b', detail: 'property removed' },
    ]);
  });

  it('an added defaulted property is minor', () => {
    const before = { 'app.a': obj({ a: { type: 'string' } }) };
    const after = { 'app.a': obj({ a: { type: 'string' }, b: { type: 'string', default: '' } }) };
    expect(classifySchemaChanges(before, after)).toEqual([
      { kind: 'minor', schemaId: 'app.a', path: 'b', detail: 'property added' },
    ]);
  });

  it('an added required property is breaking', () => {
    const before = { 'app.a': obj({ a: { type: 'string' } }) };
    const after = {
      'app.a': obj({ a: { type: 'string' }, b: { type: 'string' } }, { required: ['b'] }),
    };
    expect(classifySchemaChanges(before, after)).toEqual([
      { kind: 'breaking', schemaId: 'app.a', path: 'b', detail: 'required property added' },
    ]);
  });

  it('removing an enum value is breaking, adding one is minor', () => {
    const before = { 'face.f': obj({ m: { type: 'string', enum: ['a', 'b'] } }) };
    const after = { 'face.f': obj({ m: { type: 'string', enum: ['a', 'c'] } }) };
    expect(classifySchemaChanges(before, after)).toEqual([
      { kind: 'breaking', schemaId: 'face.f', path: 'm', detail: 'enum value removed: "b"' },
      { kind: 'minor', schemaId: 'face.f', path: 'm', detail: 'enum value added: "c"' },
    ]);
  });

  it('a changed default is patch', () => {
    const before = { 'face.f': obj({ m: { type: 'string', default: '24' } }) };
    const after = { 'face.f': obj({ m: { type: 'string', default: '12' } }) };
    expect(classifySchemaChanges(before, after)).toEqual([
      { kind: 'patch', schemaId: 'face.f', path: 'm', detail: 'default changed from "24" to "12"' },
    ]);
  });

  it('a changed type is breaking', () => {
    const before = { 'app.a': obj({ n: { type: 'string' } }) };
    const after = { 'app.a': obj({ n: { type: 'integer' } }) };
    expect(classifySchemaChanges(before, after)).toEqual([
      { kind: 'breaking', schemaId: 'app.a', path: 'n', detail: 'type changed from "string" to "integer"' },
    ]);
  });

  it('narrowing a numeric bound is breaking, widening it is minor', () => {
    const before = { 'app.a': obj({ n: { type: 'integer', minimum: 0, maximum: 100 } }) };
    const after = { 'app.a': obj({ n: { type: 'integer', minimum: 1, maximum: 200 } }) };
    expect(classifySchemaChanges(before, after)).toEqual([
      { kind: 'breaking', schemaId: 'app.a', path: 'n', detail: 'minimum raised from 0 to 1' },
      { kind: 'minor', schemaId: 'app.a', path: 'n', detail: 'maximum raised from 100 to 200' },
    ]);
  });

  it('adding a bound is breaking, removing one is minor', () => {
    const before = { 'app.a': obj({ s: { type: 'string', maxLength: 10 } }) };
    const after = { 'app.a': obj({ s: { type: 'string', minLength: 1 } }) };
    expect(classifySchemaChanges(before, after)).toEqual([
      { kind: 'breaking', schemaId: 'app.a', path: 's', detail: 'minLength added: 1' },
      { kind: 'minor', schemaId: 'app.a', path: 's', detail: 'maxLength removed' },
    ]);
  });

  it('walks nested objects and array items with dotted / [] paths', () => {
    const before = {
      'device.config': obj({
        settings: obj({ night: obj({ start: { type: 'string' }, brightness: { type: 'integer' } }) }),
        pages: { type: 'array', items: { type: 'string', enum: ['now', 'temp'] } },
      }),
    };
    const after = {
      'device.config': obj({
        settings: obj({ night: obj({ start: { type: 'string' } }) }),
        pages: { type: 'array', items: { type: 'string', enum: ['now'] } },
      }),
    };
    expect(classifySchemaChanges(before, after)).toEqual([
      { kind: 'breaking', schemaId: 'device.config', path: 'pages[]', detail: 'enum value removed: "temp"' },
      { kind: 'breaking', schemaId: 'device.config', path: 'settings.night.brightness', detail: 'property removed' },
    ]);
  });

  it('a removed schema id is breaking, a new one is minor', () => {
    const before = { 'app.old': obj({}), 'app.kept': obj({}) };
    const after = { 'app.kept': obj({}), 'app.new': obj({}) };
    expect(classifySchemaChanges(before, after)).toEqual([
      { kind: 'breaking', schemaId: 'app.old', path: '', detail: 'schema removed' },
      { kind: 'minor', schemaId: 'app.new', path: '', detail: 'schema added' },
    ]);
  });

  it('turning an object strict is breaking (stored unknown keys now fail)', () => {
    const before = { 'app.a': obj({ a: { type: 'string' } }) };
    const after = { 'app.a': obj({ a: { type: 'string' } }, { additionalProperties: false }) };
    expect(classifySchemaChanges(before, after)).toEqual([
      {
        kind: 'breaking',
        schemaId: 'app.a',
        path: '',
        detail: 'additionalProperties: false added (unknown keys now rejected)',
      },
    ]);
  });

  it('orders breaking before minor before patch across schemas', () => {
    const before = {
      'app.a': obj({ x: { type: 'string', default: '1' } }),
      'app.b': obj({ y: { type: 'string' } }),
    };
    const after = {
      'app.a': obj({ x: { type: 'string', default: '2' }, z: { type: 'string', default: '' } }),
      'app.b': obj({}),
    };
    expect(classifySchemaChanges(before, after).map((c) => c.kind)).toEqual([
      'breaking',
      'minor',
      'patch',
    ]);
  });
});

describe('buildSchemaSnapshot', () => {
  it('covers every registry schema plus device.config and stamps the fleet schema version', () => {
    const snap = buildSchemaSnapshot();
    expect(Object.keys(snap.schemas).sort()).toEqual(
      [...Object.keys(SCHEMAS), 'device.config'].sort(),
    );
    expect(snap.fleetSchemaVersion).toBe(FLEET_SCHEMA_VERSION);
  });
});

describe('serializeSnapshot / formatSchemaChanges', () => {
  it('serializes with sorted schema ids, 2-space indent and a trailing newline', () => {
    const snap: SchemaSnapshot = { fleetSchemaVersion: 1, schemas: { b: {}, a: {} } };
    expect(serializeSnapshot(snap)).toBe(
      '{\n  "fleetSchemaVersion": 1,\n  "schemas": {\n    "a": {},\n    "b": {}\n  }\n}\n',
    );
  });

  it('formats one line per change, breaking shouting, plus a count line', () => {
    const text = formatSchemaChanges([
      { kind: 'breaking', schemaId: 'face.f', path: 'm', detail: 'enum value removed: "b"' },
      { kind: 'patch', schemaId: 'face.f', path: 'm', detail: 'default changed from "a" to "c"' },
    ]);
    expect(text).toContain('BREAKING  face.f.m  enum value removed: "b"');
    expect(text).toContain('patch     face.f.m  default changed from "a" to "c"');
    expect(text).toContain('2 change(s): 1 breaking, 0 minor, 1 patch');
  });
});

describe('snapshotRefreshVerdict (what npm run snapshot:schemas does)', () => {
  const live = (schemas: Record<string, unknown>, fleetSchemaVersion = 2): SchemaSnapshot => ({
    fleetSchemaVersion,
    schemas: schemas as SchemaSnapshot['schemas'],
  });
  const base = { 'face.f': obj({ m: { type: 'string', enum: ['a', 'b'], default: 'a' } }) };

  it('creates when nothing is committed yet', () => {
    expect(snapshotRefreshVerdict(null, live(base)).action).toBe('create');
  });

  it('is current when the serialized text would not change', () => {
    expect(snapshotRefreshVerdict(live(base), live(structuredClone(base))).action).toBe('current');
  });

  it('updates on minor/patch changes without a version bump', () => {
    const next = { 'face.f': obj({ m: { type: 'string', enum: ['a', 'b', 'c'], default: 'b' } }) };
    const verdict = snapshotRefreshVerdict(live(base), live(next));
    expect(verdict.action).toBe('update');
    expect(verdict.changes.map((c) => c.kind)).toEqual(['minor', 'patch']);
  });

  it('refuses a breaking change while FLEET_SCHEMA_VERSION has not moved', () => {
    const next = { 'face.f': obj({ m: { type: 'string', enum: ['a'], default: 'a' } }) };
    const verdict = snapshotRefreshVerdict(live(base), live(next));
    expect(verdict.action).toBe('refuse');
    expect(verdict.reason).toMatch(/FLEET_SCHEMA_VERSION/);
    expect(verdict.reason).toMatch(/migrateFleet/);
  });

  it('accepts a breaking change once FLEET_SCHEMA_VERSION was bumped', () => {
    const next = { 'face.f': obj({ m: { type: 'string', enum: ['a'], default: 'a' } }) };
    expect(snapshotRefreshVerdict(live(base), live(next, 3)).action).toBe('update');
  });
});

describe('committed snapshot (src/shared/schemas.snapshot.json)', () => {
  it('exists and matches the live schemas; refresh with npm run snapshot:schemas', () => {
    expect(existsSync(SNAPSHOT_PATH), `${SNAPSHOT_PATH} missing: run npm run snapshot:schemas`).toBe(
      true,
    );
    const committedText = readFileSync(SNAPSHOT_PATH, 'utf8');
    const committed = JSON.parse(committedText) as SchemaSnapshot;
    const live = buildSchemaSnapshot();
    const changes = classifySchemaChanges(committed.schemas, live.schemas);
    expect(
      changes,
      `config schemas changed since the committed snapshot:\n${formatSchemaChanges(changes)}\n` +
        `Refresh: npm run snapshot:schemas (breaking changes also need a FLEET_SCHEMA_VERSION bump + migrateFleet step, ` +
        `otherwise stored configs on every Pi silently revert to defaults).`,
    ).toEqual([]);
    expect(
      committedText === serializeSnapshot(live),
      `${SNAPSHOT_PATH} differs in formatting only: run npm run snapshot:schemas`,
    ).toBe(true);
  });

  it('was taken at the current FLEET_SCHEMA_VERSION (a breaking change ships with its migration)', () => {
    const committed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as SchemaSnapshot;
    expect(
      committed.fleetSchemaVersion,
      'FLEET_SCHEMA_VERSION moved without refreshing the snapshot: run npm run snapshot:schemas',
    ).toBe(FLEET_SCHEMA_VERSION);
  });
});
