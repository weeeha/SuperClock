import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { auditAssets, ASSET_EXEMPT, isComputed } from '../../scripts/lib/asset-liveness.mjs';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Where a literal asset path may appear: app source plus the two HTML shells.
//
// Test files are excluded on purpose, in both directions. A test names
// fabricated paths (add-screen.test.ts uses '/x.png' as a preview fixture),
// so counting them would assert those into existence; and an asset that only
// a test references is not an asset the product ships, so counting them the
// other way would keep dead art alive. Verified 2026-09-06: no file in
// public/ is referenced solely by a test.
const SOURCE_ROOTS = ['src'];
const SOURCE_FILES = ['index.html', 'admin/index.html'];

const corpus = [
  ...SOURCE_ROOTS.flatMap((d) => walk(d)).filter(
    (f) => /\.(tsx?|css|html|json)$/.test(f) && !/\.test\.tsx?$/.test(f),
  ),
  ...SOURCE_FILES,
]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const assets = walk('public').map((f) => relative('public', f));

describe('public/ asset liveness', () => {
  it('every asset is referenced, computed, or exempt', () => {
    expect(auditAssets(assets, corpus)).toEqual([]);
  });

  it('no exempt entry is stale', () => {
    for (const [rel, reason] of Object.entries(ASSET_EXEMPT)) {
      expect(
        existsSync(join('public', rel)),
        `ASSET_EXEMPT['${rel}'] names a file that no longer exists — delete the line`,
      ).toBe(true);
      expect(
        corpus.includes(`/${rel}`),
        `ASSET_EXEMPT['${rel}'] now has a real reference — delete the line (reason was: ${reason})`,
      ).toBe(false);
    }
  });

  it('every asset path named in source resolves to a real file', () => {
    const referenced = [
      ...corpus.matchAll(/["'`](\/[\w./-]+\.(?:png|svg|jpg|jpeg|webp|m4a|mp3))["'`]/g),
    ].map((m) => m[1]);
    for (const ref of new Set(referenced)) {
      if (isComputed(ref.slice(1))) continue;
      expect(
        existsSync(join('public', ref)),
        `source names ${ref} but public${ref} does not exist`,
      ).toBe(true);
    }
  });
});
