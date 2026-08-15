// Scaffold a kiosk app: npm run new:app -- <kebab-id>
//
// Emits every registry touchpoint the coherence suite pins (component, index
// registration, side-import, ALL_KIOSK_APP_IDS, app.<id> schema + registry
// entries) plus a red-by-construction todo test, so `npm test` is the
// definition of done. All edits are computed before anything is written — a
// duplicate id or a drifted anchor aborts with the registry files untouched.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { chdir, argv, exit } from 'node:process';

import {
  validateId,
  kebabToPascal,
  appComponentTemplate,
  appIndexTemplate,
  appSchemaTemplate,
  todoTestTemplate,
  insertAppSideImport,
  insertKioskAppId,
  insertSchemaRegistryImport,
  insertSchemaRegistryEntry,
} from './lib/scaffold-templates.mjs';

chdir(fileURLToPath(new URL('..', import.meta.url)));

const id = argv[2];
if (!id) {
  console.error('usage: npm run new:app -- <kebab-id>');
  exit(1);
}

try {
  validateId(id);
  const pascal = kebabToPascal(id);

  const newFiles = {
    [`src/apps/${id}/${pascal}App.tsx`]: appComponentTemplate(id),
    [`src/apps/${id}/index.ts`]: appIndexTemplate(id),
    [`src/apps/${id}/${id}.todo.test.ts`]: todoTestTemplate(id, `src/apps/${id}/${pascal}App.tsx`),
    [`src/shared/schemas/app.${id}.ts`]: appSchemaTemplate(id),
  };
  for (const path of Object.keys(newFiles)) {
    if (existsSync(path)) throw new Error(`refusing to overwrite ${path}`);
  }

  const edits = {};
  const edit = (path, fn) => {
    edits[path] = fn(readFileSync(path, 'utf8'));
  };
  edit('src/apps/index.ts', (s) => insertAppSideImport(s, id));
  edit('src/shared/capabilities.ts', (s) => insertKioskAppId(s, id));
  edit('src/shared/schema-registry.ts', (s) =>
    insertSchemaRegistryEntry(insertSchemaRegistryImport(s, 'app', id), 'app', id),
  );

  // Nothing threw — now write.
  mkdirSync(`src/apps/${id}`, { recursive: true });
  for (const [path, content] of Object.entries({ ...newFiles, ...edits })) {
    writeFileSync(path, content);
  }

  console.log(`new:app — scaffolded '${id}'. Next steps:
  1. Implement src/apps/${id}/${pascal}App.tsx and remove its SCAFFOLD-TODO marker.
  2. Fill in src/shared/schemas/app.${id}.ts (every field needs .default()).
  3. Set real metadata (icon/description/category) in src/apps/${id}/index.ts.
  4. Delete src/apps/${id}/${id}.todo.test.ts once implemented.
  5. npm test && npm run check:tokens — both must be green before "done".`);
} catch (e) {
  console.error(`new:app — ${e.message}`);
  exit(1);
}
