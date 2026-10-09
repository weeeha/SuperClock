import { describe, it, expect } from 'vitest';
import { ALLOWLIST, WATCHED_DIRS, planSync } from './avatar-sync';
import { AVATAR_DESIGNS } from '../../src/shared/ai-face-designs';

describe('avatar sync planner', () => {
  it('allowlists the shared assets, every family page triple and every design thumbnail', () => {
    expect(ALLOWLIST).toContain('assets/abstract-performance.js');
    expect(ALLOWLIST).toContain('assets/preview.css');
    expect(ALLOWLIST).toContain('characters/core-eyes/index.html');
    for (const d of AVATAR_DESIGNS) expect(ALLOWLIST).toContain(`assets/abstract/${d.character}.png`);
  });

  it('copies allowlisted files and ignores known non-runtime files', () => {
    const plan = planSync(
      [...ALLOWLIST, 'characters/core-eyes/README.md', 'characters/core-eyes/clip.gif', 'characters/core-eyes/sources/a.png'],
      ALLOWLIST,
    );
    expect(plan.copy.sort()).toEqual([...ALLOWLIST].sort());
    expect(plan.unknown).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it('reports a new upstream file in a watched directory as unknown', () => {
    const plan = planSync([...ALLOWLIST, 'characters/core-eyes/new-thing.js'], ALLOWLIST);
    expect(plan.unknown).toEqual(['characters/core-eyes/new-thing.js']);
  });

  it('reports an allowlisted file absent upstream as missing', () => {
    const plan = planSync(ALLOWLIST.filter((f) => f !== 'assets/preview.css'), ALLOWLIST);
    expect(plan.missing).toEqual(['assets/preview.css']);
  });

  it('watches each vendored family directory and the thumbnail directory', () => {
    expect(WATCHED_DIRS).toEqual(expect.arrayContaining(['characters/core-eyes', 'assets/abstract']));
  });
});
