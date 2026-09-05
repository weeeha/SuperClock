// Gate for docs/analysis/declared-vs-read.md: the committed report must equal
// what `npm run analyze` renders from the current tree. Exact-text currency is
// the ratchet: a PR that adds a schema field nobody reads cannot merge without
// regenerating the report, and the regenerated diff shows the unread list
// growing. (Lineage: the article-style `analyze` step that itemizes a library's
// token and prop usage every release.)

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  analyzeDeclaredVsRead,
  parseFaceComponentMap,
  renderDeclaredVsRead,
} from '../../src/shared/declared-vs-read';
import { collectAnalyzeInput, REPORT_PATH } from './analyze-sources';

describe('declared-vs-read report', () => {
  const input = collectAnalyzeInput();

  it('collects every registered app directory with its component, and a source for every face', () => {
    const sideImports = readFileSync('src/apps/index.ts', 'utf8');
    expect(input.apps.length).toBeGreaterThan(0);
    for (const app of input.apps) {
      expect(sideImports, `app dir '${app.id}' registers but is not side-imported`).toContain(
        `import './${app.id}';`,
      );
      expect(app.componentPath, `no <Name>App.tsx found for '${app.id}'`).toMatch(/App\.tsx$/);
    }
    const componentOf = parseFaceComponentMap(input.faceComponentsSource);
    for (const face of input.faces) {
      expect(input.faceSources[componentOf[face.id]], `no component source for face '${face.id}'`).toBeTruthy();
    }
  });

  it(`${REPORT_PATH} is current (refresh: npm run analyze -- --write)`, () => {
    expect(existsSync(REPORT_PATH), `${REPORT_PATH} missing: run npm run analyze -- --write`).toBe(true);
    const committed = readFileSync(REPORT_PATH, 'utf8');
    const live = renderDeclaredVsRead(analyzeDeclaredVsRead(input));
    expect(
      committed,
      `${REPORT_PATH} is stale: run npm run analyze -- --write and commit the diff (an unread field growing IS the finding).`,
    ).toBe(live);
  });
});
