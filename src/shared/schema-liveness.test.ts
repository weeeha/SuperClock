// Schema liveness — the consumption half of the registry contract.
//
// registry-coherence pins that every app and face HAS a schema and that the
// admin can render a form for it; registry-contract pins that every schema
// file is registered. Neither can see whether the component on the glass ever
// READS the schema. Decision record D4 (2026-07-24) measured the result: 4 of
// 12 apps read their config, 1 face parsed faceConfig — "the admin is a remote
// control for a device that is mostly not listening". Structural consistency
// was automated; semantic consistency was not. This gate walks the chain one
// link further: declared schema → a VALUE import of that schema module from
// the component that owns it (the Calendar pattern:
// `schema.safeParse(config ?? {})` with a defaults fallback).
//
// Lineage: ds-architecture starter-kit `liveness.test.ts` (token → alias →
// consumer), retargeted from tokens to schemas. Two directions, both gated:
//   - a schema NOT on SCHEMA_UNREAD must be consumed;
//   - a schema ON SCHEMA_UNREAD must NOT be consumed — a stale ledger row is a
//     finding: delete the line the day the component starts reading it.
// The ledger may only shrink. New apps and faces never enter it: the
// scaffolders emit components born consuming their schema.
//
// Predicate limits, stated so nobody trusts them further than they go: a value
// import proves the schema object reaches the component's module graph, not
// that safeParse runs on the live config. `import type` is erased at build
// time and does not count — BreathingApp's raw `as Partial<T>` cast is exactly
// the case D4 named, and both complication renderers read `config?.x ?? d`
// the same way. Owners by kind: app.<id> → anything under src/apps/<id>/,
// face.<id> → its component per face-components.ts, complication.<id> → its
// renderer in src/shared/complications/.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMAS } from './schema-registry';

/** Schemas the admin renders a form for that nothing on the glass reads yet.
 *  One reason each. May only SHRINK: wire the component to the Calendar
 *  pattern, then delete its line here. Frozen 2026-09-05 at 14 of 27 and
 *  shrinking the same day, batch by batch. */
export const SCHEMA_UNREAD: Record<string, string> = {
  'app.claude-usage':
    'never reads config: scope / refreshSeconds / moodEnabled are admin fiction until wired',
  'app.fireplace': 'never reads config: intensity / hue are admin fiction until wired',
  'app.github':
    'never reads config: username / colorScheme / refreshMinutes come from env and constants',
  'face.productivity':
    'legacy face (predates the config contract, also on FACE_TOKEN_EXEMPT); retrofit = safeParse(faceConfig), AnalogClock is the reference',
  'face.world': 'legacy face; retrofit = safeParse(faceConfig), AnalogClock is the reference',
  'face.flip': 'legacy face; retrofit = safeParse(faceConfig), AnalogClock is the reference',
};

/** Every schema kind must have an owner mapping in consumerOf(). A new kind
 *  fails the classification test until it is placed here. */
const KINDS = ['app.', 'face.', 'complication.'] as const;

function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourcesUnder(full));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function kebabToPascal(id: string): string {
  return id
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

/** A statement-level value import whose specifier ENDS with `modulePath`
 *  (any relative prefix). `import type …` is excluded on purpose: erased at
 *  build time, it proves nothing about runtime validation. Mixed imports
 *  (`{ schema, type Config }`) are value imports and count. */
export function valueImportsModule(source: string, modulePath: string): boolean {
  const re = new RegExp(
    `^\\s*import\\s+(?!type\\s)[^;]*?from\\s+['"][^'"]*${escapeRe(modulePath)}['"]`,
    'm',
  );
  return re.test(source);
}

/** face id → component file, parsed from face-components.ts (never
 *  hand-listed — the token gate reconciles faces from the same file). */
export function faceComponentFiles(source: string): Record<string, string> {
  const nameToFile = new Map<string, string>();
  for (const m of source.matchAll(/^import\s+(\w+)\s+from\s+'\.\/(\w+)';?$/gm)) {
    nameToFile.set(m[1], m[2]);
  }
  const start = source.indexOf('FACE_COMPONENTS');
  const block = source.slice(start, source.indexOf('};', start));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/^\s*'?([\w-]+)'?:\s*(\w+),?\s*$/gm)) {
    const file = nameToFile.get(m[2]);
    if (file) out[m[1]] = `src/apps/clock/${file}.tsx`;
  }
  return out;
}

const FACE_FILES = faceComponentFiles(readFileSync('src/apps/clock/face-components.ts', 'utf8'));

/** Where a schema's consumer must live, and the module it must import. */
function consumerOf(id: string): { where: string; files: string[]; module: string } {
  const module = `schemas/${id}`;
  if (id.startsWith('app.')) {
    const dir = `src/apps/${id.slice('app.'.length)}`;
    return { where: `${dir}/**`, files: sourcesUnder(dir), module };
  }
  if (id.startsWith('face.')) {
    const file = FACE_FILES[id.slice('face.'.length)];
    if (!file) throw new Error(`no face component maps to schema '${id}' in face-components.ts`);
    return { where: file, files: [file], module };
  }
  if (id.startsWith('complication.')) {
    const file = `src/shared/complications/${kebabToPascal(id.slice('complication.'.length))}.tsx`;
    if (!existsSync(file)) throw new Error(`no renderer ${file} for schema '${id}'`);
    return { where: file, files: [file], module };
  }
  throw new Error(`unclassified schema kind: '${id}' — add its owner mapping to consumerOf()`);
}

function isConsumed(id: string): boolean {
  const { files, module } = consumerOf(id);
  return files.some((f) => valueImportsModule(readFileSync(f, 'utf8'), module));
}

const ALL = Object.keys(SCHEMAS);

describe('schema liveness (declared schema → value import in its component)', () => {
  it('every schema id has a classified kind (a new kind needs an owner mapping in consumerOf)', () => {
    for (const id of ALL) {
      expect(KINDS.some((k) => id.startsWith(k)), `unclassified schema kind: '${id}'`).toBe(true);
    }
  });

  it('every face schema maps to a component file via face-components.ts', () => {
    for (const id of ALL.filter((i) => i.startsWith('face.'))) {
      expect(FACE_FILES[id.slice('face.'.length)], `no component for '${id}'`).toBeDefined();
    }
  });

  it('every schema off the ledger is read by the component that owns it', () => {
    const unread = ALL.filter((id) => !(id in SCHEMA_UNREAD) && !isConsumed(id));
    const detail = unread.map((id) => {
      const { where, module } = consumerOf(id);
      return `  ${id}: nothing under ${where} value-imports '${module}'`;
    });
    expect(
      unread,
      `${unread.length} schema(s) rendered by the admin but never read on the glass:\n${detail.join('\n')}\n` +
        `Wire the component (Calendar pattern: schema.safeParse(config ?? {})) or add a ledger row with a reason.`,
    ).toEqual([]);
  });

  it('every ledger row is still true — a schema that became read must leave SCHEMA_UNREAD', () => {
    const stale = Object.keys(SCHEMA_UNREAD).filter((id) => id in SCHEMAS && isConsumed(id));
    expect(stale, `stale ledger row(s), delete them: ${stale.join(', ')}`).toEqual([]);
  });

  it('every ledger row names a registered schema and carries a reason', () => {
    for (const [id, reason] of Object.entries(SCHEMA_UNREAD)) {
      expect(SCHEMAS[id], `ledger names unknown schema '${id}'`).toBeDefined();
      expect(reason.trim().length, `ledger row '${id}' has no reason`).toBeGreaterThan(0);
    }
  });
});

describe('valueImportsModule (the predicate, pinned)', () => {
  it('accepts a value import with any relative prefix', () => {
    expect(
      valueImportsModule(
        `import { calendarAppSchema } from '../../shared/schemas/app.calendar';`,
        'schemas/app.calendar',
      ),
    ).toBe(true);
  });

  it('accepts a multi-line mixed import', () => {
    expect(
      valueImportsModule(
        `import {\n  weatherAppSchema,\n  type WeatherAppConfig,\n} from '../../shared/schemas/app.weather';`,
        'schemas/app.weather',
      ),
    ).toBe(true);
  });

  it('rejects a type-only import (erased at build time)', () => {
    expect(
      valueImportsModule(
        `import type { BreathingAppConfig } from '../../shared/schemas/app.breathing';`,
        'schemas/app.breathing',
      ),
    ).toBe(false);
  });

  it('does not match a neighbouring schema id by prefix', () => {
    expect(
      valueImportsModule(
        `import { x } from '../../shared/schemas/app.weather-extra';`,
        'schemas/app.weather',
      ),
    ).toBe(false);
  });
});
