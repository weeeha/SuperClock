// The committed index must equal a fresh emit from the meta files. An index
// that lags its sources sends the next session to a part that changed.
import { describe, it, expect } from 'vitest';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { collectMetaPaths, emitIndex, partRow } from '../../scripts/lib/parts-index.mjs';

describe('index/parts.toon', () => {
  it('exists and matches a fresh emit (run: npm run build:index)', () => {
    expect(existsSync('index/parts.toon'), 'index/parts.toon missing: run npm run build:index').toBe(true);
    const fresh = emitIndex(collectMetaPaths(globSync).map((p) => partRow(JSON.parse(readFileSync(p, 'utf8')), p)));
    expect(readFileSync('index/parts.toon', 'utf8'), 'index/parts.toon is stale: run npm run build:index').toBe(fresh);
  });

  it('lists every part once', () => {
    const lines = readFileSync('index/parts.toon', 'utf8').split('\n').filter((l) => l.startsWith('  '));
    expect(lines.length).toBe(collectMetaPaths(globSync).length);
  });
});
