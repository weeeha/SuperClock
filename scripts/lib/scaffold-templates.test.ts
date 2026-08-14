// Meta-tests for the new:app / new:face scaffolders. Two jobs:
//   1. Pin the templates' contract (marker present, registry touchpoints
//      emitted, face template born token-gate-clean) so conventions live in
//      code, not reviewer memory.
//   2. Run every insertion function against the LIVE registry files, so if an
//      anchor drifts (someone reshapes capabilities.ts or schema-registry.ts)
//      this suite fails loudly instead of the scaffolder corrupting a file.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  kebabToPascal,
  kebabToCamel,
  validateId,
  appComponentTemplate,
  appIndexTemplate,
  appSchemaTemplate,
  faceComponentTemplate,
  faceSchemaTemplate,
  todoTestTemplate,
  insertAppSideImport,
  insertKioskAppId,
  insertSchemaRegistryImport,
  insertSchemaRegistryEntry,
  insertFaceComponent,
  insertFaceRegistryEntry,
} from './scaffold-templates.mjs';
import { parseFaceComponentFiles } from './token-rules.mjs';

const ID = 'test-scaffold';
const real = (p: string) => readFileSync(p, 'utf8');

describe('id helpers', () => {
  it('converts kebab ids to Pascal and camel', () => {
    expect(kebabToPascal('claude-usage')).toBe('ClaudeUsage');
    expect(kebabToCamel('claude-usage')).toBe('claudeUsage');
    expect(kebabToPascal('todo')).toBe('Todo');
  });

  it('validateId rejects anything but kebab-case', () => {
    for (const bad of ['Foo', 'foo_bar', '1x', '', 'foo-', '-foo']) {
      expect(() => validateId(bad), bad).toThrow();
    }
    expect(() => validateId('photo-frame-2')).not.toThrow();
  });
});

describe('app templates', () => {
  it('component: default-exports <Pascal>App with AppProps and the SCAFFOLD-TODO marker', () => {
    const src = appComponentTemplate(ID);
    expect(src).toContain('export default function TestScaffoldApp');
    expect(src).toContain('AppProps');
    expect(src).toContain('isActive');
    expect(src).toContain('SCAFFOLD-TODO');
  });

  it('index: registers the app id and lazy-imports the component', () => {
    const src = appIndexTemplate(ID);
    expect(src).toContain("id: 'test-scaffold'");
    expect(src).toContain('registerApp');
    expect(src).toContain("lazy(() => import('./TestScaffoldApp'))");
  });

  it('schema: exports <camel>AppSchema/<camel>AppMeta in the house shape', () => {
    const src = appSchemaTemplate(ID);
    expect(src).toContain('export const testScaffoldAppSchema = z.object({');
    expect(src).toContain('export const testScaffoldAppMeta: FieldMetaMap');
    expect(src).toContain('z.infer<typeof testScaffoldAppSchema>');
  });
});

describe('face templates', () => {
  it('component: born token-gate-clean — consumes --face-* from the first render', () => {
    const src = faceComponentTemplate(ID);
    expect(src).toContain('export default function TestScaffoldClock');
    expect(src).toContain('FaceProps');
    expect(src).toContain('--face-bg');
    expect(src).toContain('SCAFFOLD-TODO');
  });

  it('schema: exports <camel>FaceSchema/<camel>FaceMeta', () => {
    const src = faceSchemaTemplate(ID);
    expect(src).toContain('export const testScaffoldFaceSchema = z.object({');
    expect(src).toContain('export const testScaffoldFaceMeta: FieldMetaMap');
  });
});

describe('todo test template (red-by-construction)', () => {
  it('fails while the component still carries the SCAFFOLD-TODO marker', () => {
    const src = todoTestTemplate(ID, `src/apps/${ID}/TestScaffoldApp.tsx`);
    expect(src).toContain('readFileSync');
    expect(src).toContain(`src/apps/${ID}/TestScaffoldApp.tsx`);
    expect(src).toContain('SCAFFOLD-TODO');
  });
});

describe('insertions against the live registry files', () => {
  it('apps/index.ts gains the side-import; duplicates throw', () => {
    const out = insertAppSideImport(real('src/apps/index.ts'), ID);
    expect(out.trimEnd().endsWith(`import './${ID}';`)).toBe(true);
    expect(() => insertAppSideImport(out, ID)).toThrow(/already/);
    expect(() => insertAppSideImport(real('src/apps/index.ts'), 'quote')).toThrow(/already/);
  });

  it('capabilities.ts: id lands inside ALL_KIOSK_APP_IDS; missing anchor throws', () => {
    const out = insertKioskAppId(real('src/shared/capabilities.ts'), ID);
    const arr = out.slice(out.indexOf('ALL_KIOSK_APP_IDS'), out.indexOf('];', out.indexOf('ALL_KIOSK_APP_IDS')));
    expect(arr).toContain(`'${ID}',`);
    expect(() => insertKioskAppId(real('src/shared/capabilities.ts'), 'quote')).toThrow(/already/);
    expect(() => insertKioskAppId('const x = 1;', ID)).toThrow(/anchor/);
  });

  it('schema-registry.ts: app import + entry land in the app section', () => {
    let out = insertSchemaRegistryImport(real('src/shared/schema-registry.ts'), 'app', ID);
    out = insertSchemaRegistryEntry(out, 'app', ID);
    expect(out).toContain(
      `import { testScaffoldAppSchema, testScaffoldAppMeta } from './schemas/app.${ID}';`,
    );
    expect(out).toContain(`'app.${ID}': { schema: testScaffoldAppSchema, meta: testScaffoldAppMeta },`);
    // Section order preserved: the new app entry sits before the face entries.
    expect(out.indexOf(`'app.${ID}':`)).toBeLessThan(out.indexOf(`'face.analog':`));
  });

  it('schema-registry.ts: face import + entry land in the face section', () => {
    let out = insertSchemaRegistryImport(real('src/shared/schema-registry.ts'), 'face', ID);
    out = insertSchemaRegistryEntry(out, 'face', ID);
    expect(out).toContain(
      `import { testScaffoldFaceSchema, testScaffoldFaceMeta } from './schemas/face.${ID}';`,
    );
    expect(out.indexOf(`'face.${ID}':`)).toBeGreaterThan(out.indexOf(`'face.strokes':`));
  });

  it('face-components.ts: import + FACE_COMPONENTS + SWIPE_CYCLE_ORDER, parseable by the token gate', () => {
    const out = insertFaceComponent(real('src/apps/clock/face-components.ts'), ID);
    expect(parseFaceComponentFiles(out)).toContain('TestScaffoldClock');
    expect(out).toContain(`'${ID}': TestScaffoldClock,`);
    const cycle = out.slice(out.indexOf('SWIPE_CYCLE_ORDER'));
    expect(cycle).toContain('TestScaffoldClock,');
    expect(() => insertFaceComponent(real('src/apps/clock/face-components.ts'), 'analog')).toThrow(
      /already/,
    );
  });

  it('face-registry.ts: descriptor lands inside FACES with schema id and preview path', () => {
    const out = insertFaceRegistryEntry(real('src/shared/face-registry.ts'), ID);
    const faces = out.slice(out.indexOf('export const FACES'), out.indexOf('const FACES_BY_ID'));
    expect(faces).toContain(`id: '${ID}',`);
    expect(faces).toContain(`configSchemaId: 'face.${ID}',`);
    expect(faces).toContain(`preview: '/${ID}-preview.png',`);
  });
});
