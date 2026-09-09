import { describe, expect, it } from 'vitest';
import { auditAssets, isComputed, ASSET_EXEMPT, COMPUTED_ASSET_DIRS } from './asset-liveness.mjs';

describe('asset liveness predicates', () => {
  it('reports an asset no source file names', () => {
    expect(auditAssets(['orphan.png'], 'const a = "/kept.png";')).toEqual(['orphan.png']);
  });

  it('accepts an asset named by a literal path', () => {
    expect(auditAssets(['kept.png'], 'const a = "/kept.png";')).toEqual([]);
  });

  it('matches on the leading slash so a bare substring is not a reference', () => {
    expect(auditAssets(['kept.png'], 'const a = "notkept.png";')).toEqual(['kept.png']);
  });

  it('skips a directory whose paths are built at runtime', () => {
    expect(isComputed('agents/main.png')).toBe(true);
    expect(auditAssets(['agents/main.png'], '')).toEqual([]);
  });

  it('skips an exempt file', () => {
    const [rel] = Object.keys(ASSET_EXEMPT);
    expect(auditAssets([rel], '')).toEqual([]);
  });

  it('gives every computed directory a trailing slash and a reason', () => {
    for (const [dir, reason] of Object.entries(COMPUTED_ASSET_DIRS)) {
      expect(dir.endsWith('/'), `${dir} must end in a slash`).toBe(true);
      expect(reason.length).toBeGreaterThan(20);
    }
  });
});
