// Tree walk for the declared-vs-read analysis: gathers every input the pure
// analyzer (src/shared/declared-vs-read.ts) needs from the real checkout.
// Shared by scripts/analyze.ts (the runner) and scripts/lib/analyze.test.ts
// (the gate) so both see the same sources. Relative paths: callers chdir to
// the repo root (the runner does, vitest already runs there).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMAS } from '../../src/shared/schema-registry';
import { FACES } from '../../src/shared/face-registry';
import { parseFaceComponentMap, type AnalyzeInput, type AppInput } from '../../src/shared/declared-vs-read';
import { FACE_TOKEN_EXEMPT } from './token-rules.mjs';

export const REPORT_PATH = 'docs/analysis/declared-vs-read.md';

/** Every non-test .ts/.tsx under dir, recursively, sorted for stable output. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(path);
  }
  return out.sort();
}

export function collectAnalyzeInput(): AnalyzeInput {
  const apps: AppInput[] = [];
  for (const entry of readdirSync('src/apps', { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join('src/apps', entry.name);
    const index = join(dir, 'index.ts');
    // Same rule as registry-contract: a directory is an app iff its index registers one.
    if (!existsSync(index) || !readFileSync(index, 'utf8').includes('registerApp(')) continue;
    const files = sourceFiles(dir);
    apps.push({
      id: entry.name,
      componentPath: files.find((f) => /\/[A-Z]\w*App\.tsx$/.test(f)) ?? '',
      sources: files.map((path) => ({ path, text: readFileSync(path, 'utf8') })),
    });
  }

  const faceComponentsSource = readFileSync('src/apps/clock/face-components.ts', 'utf8');
  const faceSources: Record<string, string> = {};
  for (const component of Object.values(parseFaceComponentMap(faceComponentsSource))) {
    const path = `src/apps/clock/${component}.tsx`;
    if (existsSync(path)) faceSources[component] = readFileSync(path, 'utf8');
  }

  return {
    schemas: SCHEMAS,
    apps,
    faces: FACES,
    faceComponentsSource,
    faceSources,
    faceTokenExempt: FACE_TOKEN_EXEMPT,
  };
}
