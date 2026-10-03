import { describe, it, expect } from 'vitest';
import { shouldAdvance } from './playlist';

describe('shouldAdvance', () => {
  it('advances only after the gesture cooldown and never while an alert rings', () => {
    expect(shouldAdvance(100_000, 0, false)).toBe(true);
    expect(shouldAdvance(100_000, 90_000, false)).toBe(false); // 10 s after a gesture
    expect(shouldAdvance(100_000, 0, true)).toBe(false);
  });
});
