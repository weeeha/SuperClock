// Scaffold a clock face: npm run new:face -- <kebab-id>
//
// Emits every registry touchpoint the coherence suite pins (component,
// FACE_COMPONENTS + SWIPE_CYCLE_ORDER, face-registry descriptor, face.<id>
// schema + registry entries) plus a red-by-construction todo test. The
// component template is born token-gate-clean (consumes --face-*), so night
// mode reaches a new face from its first render. All edits are computed
// before anything is written.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { chdir, argv, exit } from 'node:process';

import {
  validateId,
  kebabToPascal,
  faceComponentTemplate,
  faceSchemaTemplate,
  faceMetaTemplate,
  todoTestTemplate,
  insertFaceComponent,
  insertFaceRegistryEntry,
  insertSchemaRegistryImport,
  insertSchemaRegistryEntry,
} from './lib/scaffold-templates.mjs';

chdir(fileURLToPath(new URL('..', import.meta.url)));

const id = argv[2];
if (!id) {
  console.error('usage: npm run new:face -- <kebab-id>');
  exit(1);
}

try {
  validateId(id);
  const pascal = kebabToPascal(id);
  const componentPath = `src/apps/clock/${pascal}Clock.tsx`;

  const newFiles = {
    [componentPath]: faceComponentTemplate(id),
    [`src/apps/clock/${pascal}Clock.meta.json`]: faceMetaTemplate(id),
    [`src/apps/clock/${id}.todo.test.ts`]: todoTestTemplate(id, componentPath),
    [`src/shared/schemas/face.${id}.ts`]: faceSchemaTemplate(id),
  };
  for (const path of Object.keys(newFiles)) {
    if (existsSync(path)) throw new Error(`refusing to overwrite ${path}`);
  }

  const edits = {};
  const edit = (path, fn) => {
    edits[path] = fn(readFileSync(path, 'utf8'));
  };
  edit('src/apps/clock/face-components.ts', (s) => insertFaceComponent(s, id));
  edit('src/shared/face-registry.ts', (s) => insertFaceRegistryEntry(s, id));
  edit('src/shared/schema-registry.ts', (s) =>
    insertSchemaRegistryEntry(insertSchemaRegistryImport(s, 'face', id), 'face', id),
  );

  // Nothing threw — now write.
  for (const [path, content] of Object.entries({ ...newFiles, ...edits })) {
    writeFileSync(path, content);
  }

  console.log(`new:face — scaffolded '${id}'. Next steps:
  1. Implement ${componentPath} and remove its SCAFFOLD-TODO marker
     (keep consuming --face-* — the token gate holds new faces to it).
  2. Fill in src/shared/schemas/face.${id}.ts (every field needs .default()).
  3. Write src/apps/clock/${pascal}Clock.meta.json: replace every TODO with the
     judgment (purpose, accent, night recipe, an intent per option, anti-patterns
     with the why); use a spec block for a hand-and-tick face, specless otherwise.
     Then npm run build:index. The contract gate is red until this is done.
  4. Drop 1000×1000 preview art at public/${id}-preview.png and set the real
     category in src/shared/face-registry.ts.
  5. Delete src/apps/clock/${id}.todo.test.ts once implemented.
  6. npm test && npm run check:tokens — both must be green before "done".
  7. Shared-face parity: if this face will exist on superclock-slow too, set
     parity.lvgl in the meta and plan the LVGL sibling (AGENTS.md "React <-> LVGL face parity").`);
} catch (e) {
  console.error(`new:face — ${e.message}`);
  exit(1);
}
