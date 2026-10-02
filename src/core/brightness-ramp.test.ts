import { describe, it, expect } from 'vitest';
import { rampTransition } from './brightness-ramp';

describe('rampTransition', () => {
  it('fades the filter out linearly by the alarm time', () => {
    expect(rampTransition(10_000, 4000)).toBe('filter 6000ms linear');
    expect(rampTransition(10_000, 12_000)).toBe('filter 0ms linear');
  });
});
