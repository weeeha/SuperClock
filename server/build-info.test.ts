// The build stamp is what makes deploys verifiable: deploy.sh compares the
// commit it shipped against what /api/health reports after restart. These
// tests pin the reader's honesty — no file, or a mangled file, must read as
// "no build info" (null), never as a fabricated stamp.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBuildInfo } from './build-info';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'build-info-'));
}

describe('readBuildInfo', () => {
  it('returns the stamp when build-info.json is present and valid', () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, 'build-info.json'),
      JSON.stringify({ commit: 'abc123', branch: 'main', builtAt: '2026-08-07T00:00:00.000Z' }),
    );
    expect(readBuildInfo(dir)).toEqual({
      commit: 'abc123',
      branch: 'main',
      builtAt: '2026-08-07T00:00:00.000Z',
    });
  });

  it('returns null when the file is absent (dev server from source)', () => {
    expect(readBuildInfo(tempDir())).toBeNull();
  });

  it('returns null on malformed JSON rather than throwing', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'build-info.json'), '{not json');
    expect(readBuildInfo(dir)).toBeNull();
  });

  it('returns null when the commit field is missing — a stamp without a commit is no stamp', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'build-info.json'), JSON.stringify({ branch: 'main' }));
    expect(readBuildInfo(dir)).toBeNull();
  });
});
