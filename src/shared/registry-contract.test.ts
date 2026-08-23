// Filesystem ↔ registry contract — the orphan checks registry-coherence.test.ts
// structurally cannot do. Coherence pins the registries against EACH OTHER;
// but a file that reached NO registry (an app dir whose side-import was
// forgotten, a schema file never imported) leaves every list agreeing while
// the thing is invisible. Only filesystem-vs-registry can catch absence.
// Lineage: Super-AI-Components' contract gate ("orphan detection: any file
// with no manifest row is an error").

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FACES } from './face-registry';
import { SCHEMAS } from './schema-registry';
import { APP_ICONS } from './app-icons';
import { appDisplayName } from '../admin/lib/app-names';

describe('filesystem ↔ registry contract', () => {
  it('every app directory that calls registerApp is side-imported in src/apps/index.ts', () => {
    const sideImports = readFileSync('src/apps/index.ts', 'utf8');
    for (const entry of readdirSync('src/apps', { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const indexPath = join('src/apps', entry.name, 'index.ts');
      if (!existsSync(indexPath)) continue;
      if (!readFileSync(indexPath, 'utf8').includes('registerApp(')) continue;
      expect(
        sideImports,
        `src/apps/${entry.name} registers an app but src/apps/index.ts never imports it — ` +
          `unimported means unregistered, so every registry agrees while the app is invisible`,
      ).toContain(`import './${entry.name}';`);
    }
  });

  it('every schema file under src/shared/schemas/ has a SCHEMAS entry', () => {
    for (const file of readdirSync('src/shared/schemas')) {
      const m = /^(app|face|complication)\.([a-z0-9-]+)\.ts$/.exec(file);
      if (!m) continue; // *.test.ts and friends
      const id = `${m[1]}.${m[2]}`;
      expect(
        SCHEMAS[id],
        `src/shared/schemas/${file} exists but SCHEMAS['${id}'] is missing — dead file or forgotten import`,
      ).toBeDefined();
    }
  });

  it('every *Clock.tsx in src/apps/clock/ is imported by face-components.ts (ClockApp excluded)', () => {
    // Filename-convention check: Complications* faces predate the convention
    // and are covered by coherence via FACE_COMPONENTS ↔ FACES instead.
    const faceSource = readFileSync('src/apps/clock/face-components.ts', 'utf8');
    for (const file of readdirSync('src/apps/clock')) {
      const m = /^(\w+Clock)\.tsx$/.exec(file);
      if (!m || file === 'ClockApp.tsx') continue;
      expect(
        faceSource,
        `src/apps/clock/${file} looks like a face but face-components.ts never imports it`,
      ).toContain(`from './${m[1]}'`);
    }
  });

  it("the admin's app display names match the kiosk registrations (glass truth)", () => {
    // Parse the kiosk metadata straight from source — the admin cannot import
    // src/apps/*/index.ts (they register lazy React components), so the name
    // map in src/admin/lib/app-names.ts is a copy. This pins the copy.
    for (const entry of readdirSync('src/apps', { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const indexPath = join('src/apps', entry.name, 'index.ts');
      if (!existsSync(indexPath)) continue;
      const src = readFileSync(indexPath, 'utf8');
      const id = /id: '([a-z0-9-]+)'/.exec(src)?.[1];
      const name = /name: '([^']+)'/.exec(src)?.[1];
      if (!id || !name) continue;
      expect(
        appDisplayName(id),
        `admin app-names disagrees with the kiosk for '${id}' — the kiosk registers '${name}'`,
      ).toBe(name);
    }
  });

  it('every app icon path resolves to a real file in public/', () => {
    for (const [appId, src] of Object.entries(APP_ICONS)) {
      expect(
        existsSync(join('public', src)),
        `APP_ICONS['${appId}'] points at ${src} but public${src} does not exist`,
      ).toBe(true);
    }
  });

  it('every face preview path resolves to a real file in public/', () => {
    for (const face of FACES) {
      expect(
        existsSync(join('public', face.preview)),
        `face '${face.id}' declares preview ${face.preview} but public${face.preview} does not exist`,
      ).toBe(true);
    }
  });
});
