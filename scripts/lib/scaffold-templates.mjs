// Pure templates + registry-insertion functions for scripts/new-app.mjs and
// scripts/new-face.mjs. fs-free so scaffold-templates.test.ts can pin the
// whole contract (SAC pattern: conventions live in templates pinned by tests,
// not in reviewer memory). Every insertion throws on a missing anchor or a
// duplicate id — the runner never writes a half-edited registry file.

export function validateId(id) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`id must be kebab-case ([a-z0-9-], no leading/trailing dash): '${id}'`);
  }
}

export function kebabToPascal(id) {
  return id
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

export function kebabToCamel(id) {
  const pascal = kebabToPascal(id);
  return pascal[0].toLowerCase() + pascal.slice(1);
}

function kebabToTitle(id) {
  return id
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function appComponentTemplate(id) {
  const pascal = kebabToPascal(id);
  const title = kebabToTitle(id);
  return `import type { AppProps } from '../../core/types';

// SCAFFOLD-TODO: implement ${pascal}App. House rules that apply from day one:
// gate any setInterval/rAF on \`isActive\` (background apps must not tick),
// and if this app fetches, design the honest offline tell before the happy
// path (WeatherApp is the reference).
export default function ${pascal}App({ isActive }: AppProps) {
  void isActive;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className="font-display text-2xl opacity-40">${title} scaffold</span>
    </div>
  );
}
`;
}

export function appIndexTemplate(id) {
  const pascal = kebabToPascal(id);
  const title = kebabToTitle(id);
  return `import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: '${id}',
    name: '${title}',
    icon: '\\u{2699}', // SCAFFOLD-TODO: pick a real icon
    description: '${title}', // SCAFFOLD-TODO: one-line description
    category: 'ambient', // SCAFFOLD-TODO: match an existing category
  },
  component: lazy(() => import('./${pascal}App')),
});
`;
}

export function appSchemaTemplate(id) {
  const camel = kebabToCamel(id);
  const pascal = kebabToPascal(id);
  return `import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const ${camel}AppSchema = z.object({
  // SCAFFOLD-TODO: real config fields. Every field needs .default(...) —
  // defaultsFor() seeds admin forms from schema.parse({}) and the
  // registry-coherence suite asserts it succeeds.
  // example: z.enum(['a', 'b']).default('a'),
});

export const ${camel}AppMeta: FieldMetaMap = {};

export type ${pascal}AppConfig = z.infer<typeof ${camel}AppSchema>;
`;
}

export function faceComponentTemplate(id) {
  const pascal = kebabToPascal(id);
  const title = kebabToTitle(id);
  return `import type { FaceProps } from './face-components';

// SCAFFOLD-TODO: implement the ${title} face. Born under two contracts:
// consume --face-* tokens so the night flip reaches it (src/index.css — this
// scaffold already does, keep it that way), and the one-accent-quantity rule
// (at most one saturated accent quantity on the dial). Gate ticking on
// \`isActive\`; hand angles come from useClockHands, never setInterval.
export default function ${pascal}Clock({ isActive }: FaceProps) {
  void isActive;
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: 'var(--face-bg)', color: 'var(--face-ink)' }}
    >
      <span className="font-display text-2xl opacity-40">${title} scaffold</span>
    </div>
  );
}
`;
}

export function faceSchemaTemplate(id) {
  const camel = kebabToCamel(id);
  const pascal = kebabToPascal(id);
  return `import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const ${camel}FaceSchema = z.object({
  // SCAFFOLD-TODO: real face options (every field needs .default(...)).
});

export const ${camel}FaceMeta: FieldMetaMap = {};

export type ${pascal}FaceConfig = z.infer<typeof ${camel}FaceSchema>;
`;
}

export function todoTestTemplate(id, componentPath) {
  return `import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Scaffolded red-by-construction: fails until the SCAFFOLD-TODO marker is
// removed from the component (i.e. it has been implemented). Then delete this
// file — registry coherence and the token gate own the component from there.
describe('${id} scaffold', () => {
  it('has been implemented', () => {
    const src = readFileSync('${componentPath}', 'utf8');
    expect(
      src.includes('SCAFFOLD-TODO'),
      'implement ${componentPath}, remove its SCAFFOLD-TODO marker, then delete this test',
    ).toBe(false);
  });
});
`;
}

// ---------------------------------------------------------------------------
// Registry insertions. All throw before returning a half-edited source.
// ---------------------------------------------------------------------------

function assertAbsent(source, needle, what) {
  if (source.includes(needle)) {
    throw new Error(`${what} already present: ${needle}`);
  }
}

function findAnchor(source, anchor, file) {
  const i = source.indexOf(anchor);
  if (i === -1) throw new Error(`anchor not found in ${file}: ${anchor}`);
  return i;
}

/** src/apps/index.ts — append the registration side-import. */
export function insertAppSideImport(source, id) {
  assertAbsent(source, `import './${id}';`, 'side-import');
  return `${source.trimEnd()}\nimport './${id}';\n`;
}

/** src/shared/capabilities.ts — add the id to ALL_KIOSK_APP_IDS. */
export function insertKioskAppId(source, id) {
  const anchor = 'const ALL_KIOSK_APP_IDS = [';
  const start = findAnchor(source, anchor, 'capabilities.ts');
  const end = source.indexOf('];', start);
  if (end === -1) throw new Error('anchor not found: ALL_KIOSK_APP_IDS closing ];');
  const region = source.slice(start, end);
  assertAbsent(region, `'${id}'`, 'kiosk app id');
  return `${source.slice(0, end)}  '${id}',\n${source.slice(end)}`;
}

const KIND_SUFFIX = { app: 'App', face: 'Face' };

/** src/shared/schema-registry.ts — import line, appended to its kind's group. */
export function insertSchemaRegistryImport(source, kind, id) {
  const camel = kebabToCamel(id);
  const suffix = KIND_SUFFIX[kind];
  assertAbsent(source, `./schemas/${kind}.${id}'`, 'schema import');
  const marker = `from './schemas/${kind}.`;
  const last = source.lastIndexOf(marker);
  if (last === -1) throw new Error(`anchor not found in schema-registry.ts: ${marker}`);
  const lineEnd = source.indexOf('\n', last);
  const line = `import { ${camel}${suffix}Schema, ${camel}${suffix}Meta } from './schemas/${kind}.${id}';`;
  return `${source.slice(0, lineEnd + 1)}${line}\n${source.slice(lineEnd + 1)}`;
}

/** src/shared/schema-registry.ts — SCHEMAS entry, inside its kind's section. */
export function insertSchemaRegistryEntry(source, kind, id) {
  const camel = kebabToCamel(id);
  const suffix = KIND_SUFFIX[kind];
  assertAbsent(source, `'${kind}.${id}':`, 'schema entry');
  const schemasStart = findAnchor(source, 'export const SCHEMAS', 'schema-registry.ts');
  const entry = `  '${kind}.${id}': { schema: ${camel}${suffix}Schema, meta: ${camel}${suffix}Meta },`;
  // Apps sit before the "// Faces" section; faces go last, before the closing.
  const at =
    kind === 'app'
      ? source.indexOf('\n\n  // Faces', schemasStart)
      : source.indexOf('\n};', schemasStart);
  if (at === -1) throw new Error(`anchor not found: SCHEMAS ${kind} section boundary`);
  return `${source.slice(0, at)}\n${entry}${source.slice(at)}`;
}

/** src/apps/clock/face-components.ts — import + FACE_COMPONENTS + SWIPE_CYCLE_ORDER. */
export function insertFaceComponent(source, id) {
  const pascal = kebabToPascal(id);
  const component = `${pascal}Clock`;
  if (new RegExp(`(^|[\\s'])${id}'?:`, 'm').test(source)) {
    throw new Error(`face id already present in FACE_COMPONENTS: ${id}`);
  }
  assertAbsent(source, `from './${component}'`, 'face component import');

  // Import: after the last relative default import.
  const importRe = /^import \w+ from '\.\/\w+';$/gm;
  let lastImport = null;
  for (const m of source.matchAll(importRe)) lastImport = m;
  if (!lastImport) throw new Error('anchor not found in face-components.ts: relative imports');
  const importEnd = lastImport.index + lastImport[0].length;
  let out = `${source.slice(0, importEnd)}\nimport ${component} from './${component}';${source.slice(importEnd)}`;

  // FACE_COMPONENTS entry, before that object's closing. Kebab ids are quoted
  // (house style); plain ids stay bare.
  const key = id.includes('-') ? `'${id}'` : id;
  const mapStart = findAnchor(out, 'export const FACE_COMPONENTS', 'face-components.ts');
  const mapEnd = out.indexOf('\n};', mapStart);
  if (mapEnd === -1) throw new Error('anchor not found: FACE_COMPONENTS closing');
  out = `${out.slice(0, mapEnd)}\n  ${key}: ${component},${out.slice(mapEnd)}`;

  // SWIPE_CYCLE_ORDER entry, before that array's closing.
  const cycleStart = findAnchor(out, 'export const SWIPE_CYCLE_ORDER', 'face-components.ts');
  const cycleEnd = out.indexOf('\n];', cycleStart);
  if (cycleEnd === -1) throw new Error('anchor not found: SWIPE_CYCLE_ORDER closing');
  return `${out.slice(0, cycleEnd)}\n  ${component},${out.slice(cycleEnd)}`;
}

/** src/shared/face-registry.ts — FaceDescriptor entry inside FACES. */
export function insertFaceRegistryEntry(source, id) {
  assertAbsent(source, `id: '${id}',`, 'face descriptor');
  const start = findAnchor(source, 'export const FACES', 'face-registry.ts');
  const end = source.indexOf('\n];', start);
  if (end === -1) throw new Error('anchor not found: FACES closing');
  const entry = `  {
    id: '${id}',
    name: '${kebabToTitle(id)}',
    // SCAFFOLD-TODO: drop real preview art at public/${id}-preview.png
    // (1000×1000 capture of the face at a fixed time — see face-registry header).
    preview: '/${id}-preview.png',
    category: 'modern', // SCAFFOLD-TODO: classic | modern | data-rich | artistic
    configSchemaId: 'face.${id}',
    slots: [],
  },`;
  return `${source.slice(0, end)}\n${entry}${source.slice(end)}`;
}
