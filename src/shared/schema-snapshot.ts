// JSON Schema snapshot of every config contract this repo ships: the registry
// schemas (app.* / face.* / complication.*) plus the fleet's device.config
// shape. Pure (no fs): scripts/snapshot-schemas.ts and schema-snapshot.test.ts
// own reading and writing the committed file at SNAPSHOT_PATH.
//
// Why JSON Schema rather than diffing the zod source: a code diff says "line
// changed"; this diff says "enum value removed", which is the question a
// reviewer actually has. Classification follows the versioned-library rule:
// a change that makes an already-stored value fail validation is BREAKING
// (every consumer falls back to schema.parse({}), so the user's whole config
// silently reverts), a change that only admits more values is minor, and a
// changed default is patch.

import { z } from 'zod';
import { SCHEMAS } from './schema-registry';
import { deviceConfigSchema, FLEET_SCHEMA_VERSION } from './device-config-schema';

export const SNAPSHOT_PATH = 'src/shared/schemas.snapshot.json';

export type JsonSchema = Record<string, unknown>;

export interface SchemaSnapshot {
  fleetSchemaVersion: number;
  schemas: Record<string, JsonSchema>;
}

export type ChangeKind = 'breaking' | 'minor' | 'patch';

export interface SchemaChange {
  kind: ChangeKind;
  schemaId: string;
  path: string;
  detail: string;
}

function isNode(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Sort object keys recursively so reordering fields in a zod object is not a diff. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isNode(value)) {
    const out: JsonSchema = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

export function toSnapshotSchema(schema: z.ZodType): JsonSchema {
  // io: 'input' is the stored-config view: defaulted fields are optional on the
  // way in, which is exactly what safeParse(stored) validates.
  const json: JsonSchema = { ...z.toJSONSchema(schema, { io: 'input' }) };
  delete json.$schema;
  return canonicalize(json) as JsonSchema;
}

export function buildSchemaSnapshot(): SchemaSnapshot {
  const schemas: Record<string, JsonSchema> = {};
  for (const [id, entry] of Object.entries(SCHEMAS)) schemas[id] = toSnapshotSchema(entry.schema);
  schemas['device.config'] = toSnapshotSchema(deviceConfigSchema);
  return { fleetSchemaVersion: FLEET_SCHEMA_VERSION, schemas };
}

export function serializeSnapshot(snapshot: SchemaSnapshot): string {
  const schemas: Record<string, JsonSchema> = {};
  for (const id of Object.keys(snapshot.schemas).sort()) schemas[id] = snapshot.schemas[id];
  return `${JSON.stringify({ fleetSchemaVersion: snapshot.fleetSchemaVersion, schemas }, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const KIND_ORDER: Record<ChangeKind, number> = { breaking: 0, minor: 1, patch: 2 };
const LOWER_BOUNDS = ['minimum', 'exclusiveMinimum', 'minLength', 'minItems'];
const UPPER_BOUNDS = ['maximum', 'exclusiveMaximum', 'maxLength', 'maxItems'];
const HANDLED_KEYS = new Set([
  'type',
  'enum',
  'default',
  'properties',
  'required',
  'items',
  'additionalProperties',
  'anyOf',
  'pattern',
  ...LOWER_BOUNDS,
  ...UPPER_BOUNDS,
]);

const fmt = (value: unknown): string => JSON.stringify(value) ?? 'undefined';
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

type Push = (kind: ChangeKind, detail: string) => void;

function diffBound(key: string, side: 'lower' | 'upper', b: JsonSchema, a: JsonSchema, push: Push) {
  const bv = b[key];
  const av = a[key];
  if (same(bv, av)) return;
  if (bv === undefined) return push('breaking', `${key} added: ${fmt(av)}`);
  if (av === undefined) return push('minor', `${key} removed`);
  if (typeof bv !== 'number' || typeof av !== 'number') {
    return push('breaking', `${key} changed from ${fmt(bv)} to ${fmt(av)}`);
  }
  const raised = av > bv;
  const narrowing = side === 'lower' ? raised : !raised;
  push(narrowing ? 'breaking' : 'minor', `${key} ${raised ? 'raised' : 'lowered'} from ${bv} to ${av}`);
}

function diffNode(schemaId: string, path: string, b: JsonSchema, a: JsonSchema, out: SchemaChange[]) {
  const push: Push = (kind, detail) => out.push({ kind, schemaId, path, detail });

  if (!same(b.type, a.type)) push('breaking', `type changed from ${fmt(b.type)} to ${fmt(a.type)}`);

  const bEnum = Array.isArray(b.enum) ? b.enum : null;
  const aEnum = Array.isArray(a.enum) ? a.enum : null;
  if (!bEnum && aEnum) push('breaking', `enum added: ${aEnum.map(fmt).join(', ')}`);
  else if (bEnum && !aEnum) push('minor', 'enum removed');
  else if (bEnum && aEnum) {
    for (const v of bEnum) {
      if (!aEnum.some((w) => same(v, w))) push('breaking', `enum value removed: ${fmt(v)}`);
    }
    for (const v of aEnum) {
      if (!bEnum.some((w) => same(v, w))) push('minor', `enum value added: ${fmt(v)}`);
    }
  }

  for (const key of LOWER_BOUNDS) diffBound(key, 'lower', b, a, push);
  for (const key of UPPER_BOUNDS) diffBound(key, 'upper', b, a, push);

  if (!same(b.pattern, a.pattern)) {
    if (a.pattern === undefined) push('minor', 'pattern removed');
    else if (b.pattern === undefined) push('breaking', `pattern added: ${fmt(a.pattern)}`);
    else push('breaking', `pattern changed from ${fmt(b.pattern)} to ${fmt(a.pattern)}`);
  }

  if (!same(b.default, a.default)) {
    push('patch', `default changed from ${fmt(b.default)} to ${fmt(a.default)}`);
  }

  const bAdd = b.additionalProperties;
  const aAdd = a.additionalProperties;
  if (isNode(bAdd) && isNode(aAdd)) diffNode(schemaId, `${path}[*]`, bAdd, aAdd, out);
  else if (!same(bAdd, aAdd)) {
    if (aAdd === false) push('breaking', 'additionalProperties: false added (unknown keys now rejected)');
    else if (bAdd === false) push('minor', 'additionalProperties: false removed');
    else push('patch', `additionalProperties changed from ${fmt(bAdd)} to ${fmt(aAdd)}`);
  }

  const bAny = Array.isArray(b.anyOf) ? b.anyOf.map((x) => JSON.stringify(x)) : [];
  const aAny = Array.isArray(a.anyOf) ? a.anyOf.map((x) => JSON.stringify(x)) : [];
  for (const x of bAny) if (!aAny.includes(x)) push('breaking', `anyOf option removed: ${x}`);
  for (const x of aAny) if (!bAny.includes(x)) push('minor', `anyOf option added: ${x}`);

  const bReq = new Set(Array.isArray(b.required) ? (b.required as string[]) : []);
  const aReq = new Set(Array.isArray(a.required) ? (a.required as string[]) : []);
  const bProps = isNode(b.properties) ? b.properties : {};
  const aProps = isNode(a.properties) ? a.properties : {};
  const keys = new Set([...Object.keys(bProps), ...Object.keys(aProps)]);
  for (const key of [...keys].sort()) {
    const childPath = path ? `${path}.${key}` : key;
    const bChild = bProps[key];
    const aChild = aProps[key];
    if (!isNode(bChild)) {
      out.push({
        kind: aReq.has(key) ? 'breaking' : 'minor',
        schemaId,
        path: childPath,
        detail: aReq.has(key) ? 'required property added' : 'property added',
      });
      continue;
    }
    if (!isNode(aChild)) {
      out.push({ kind: 'breaking', schemaId, path: childPath, detail: 'property removed' });
      continue;
    }
    if (!bReq.has(key) && aReq.has(key)) {
      out.push({ kind: 'breaking', schemaId, path: childPath, detail: 'property now required' });
    } else if (bReq.has(key) && !aReq.has(key)) {
      out.push({ kind: 'minor', schemaId, path: childPath, detail: 'property no longer required' });
    }
    diffNode(schemaId, childPath, bChild, aChild, out);
  }

  if (isNode(b.items) && isNode(a.items)) diffNode(schemaId, `${path}[]`, b.items, a.items, out);
  else if (!same(b.items, a.items)) {
    push('breaking', `items changed from ${fmt(b.items)} to ${fmt(a.items)}`);
  }

  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (HANDLED_KEYS.has(key) || same(b[key], a[key])) continue;
    push('patch', `${key} changed from ${fmt(b[key])} to ${fmt(a[key])}`);
  }
}

export function classifySchemaChanges(
  before: Record<string, JsonSchema>,
  after: Record<string, JsonSchema>,
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const schemaId of [...ids].sort()) {
    const b = before[schemaId];
    const a = after[schemaId];
    if (!b) changes.push({ kind: 'minor', schemaId, path: '', detail: 'schema added' });
    else if (!a) changes.push({ kind: 'breaking', schemaId, path: '', detail: 'schema removed' });
    else diffNode(schemaId, '', b, a, changes);
  }
  return changes.sort(
    (x, y) =>
      KIND_ORDER[x.kind] - KIND_ORDER[y.kind] ||
      x.schemaId.localeCompare(y.schemaId) ||
      x.path.localeCompare(y.path),
  );
}

export function formatSchemaChanges(changes: SchemaChange[]): string {
  const count = (kind: ChangeKind) => changes.filter((c) => c.kind === kind).length;
  const lines = changes.map((c) => {
    const label = (c.kind === 'breaking' ? 'BREAKING' : c.kind).padEnd(9);
    const where = c.path ? `${c.schemaId}.${c.path}` : c.schemaId;
    return `  ${label} ${where}  ${c.detail}`;
  });
  lines.push(
    `  ${changes.length} change(s): ${count('breaking')} breaking, ${count('minor')} minor, ${count('patch')} patch`,
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Refresh decision (scripts/snapshot-schemas.ts)
// ---------------------------------------------------------------------------

export interface RefreshVerdict {
  action: 'create' | 'current' | 'update' | 'refuse';
  changes: SchemaChange[];
  reason?: string;
}

/**
 * A breaking change may only be snapshotted once FLEET_SCHEMA_VERSION has
 * moved past the committed snapshot's version, i.e. once a migrateFleet step
 * exists to rewrite the configs that would otherwise fail validation.
 */
export function snapshotRefreshVerdict(
  committed: SchemaSnapshot | null,
  live: SchemaSnapshot,
): RefreshVerdict {
  if (!committed) return { action: 'create', changes: [] };
  const changes = classifySchemaChanges(committed.schemas, live.schemas);
  if (serializeSnapshot(committed) === serializeSnapshot(live)) return { action: 'current', changes };
  const breaking = changes.filter((c) => c.kind === 'breaking').length;
  if (breaking && live.fleetSchemaVersion <= committed.fleetSchemaVersion) {
    return {
      action: 'refuse',
      changes,
      reason:
        `${breaking} breaking change(s) but FLEET_SCHEMA_VERSION is still ${live.fleetSchemaVersion}. ` +
        'Stored configs on every Pi would silently revert to defaults. Bump FLEET_SCHEMA_VERSION in ' +
        'src/shared/device-config-schema.ts and add the rewrite step to migrateFleet in ' +
        'server/fleet-store.ts, then re-run.',
    };
  }
  return { action: 'update', changes };
}
