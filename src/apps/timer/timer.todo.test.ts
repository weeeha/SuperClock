import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Scaffolded red-by-construction: fails until the SCAFFOLD-TODO marker is
// removed from the component (i.e. it has been implemented). Then delete this
// file — registry coherence and the token gate own the component from there.
describe('timer scaffold', () => {
  it('has been implemented', () => {
    const src = readFileSync('src/apps/timer/TimerApp.tsx', 'utf8');
    expect(
      src.includes('SCAFFOLD-TODO'),
      'implement src/apps/timer/TimerApp.tsx, remove its SCAFFOLD-TODO marker, then delete this test',
    ).toBe(false);
  });
});
