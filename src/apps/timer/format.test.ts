import { describe, it, expect } from 'vitest';
import { formatClock, formatMinutes, formatMMSS } from './format';

describe('format', () => {
  it('formats a readout, rounding up partial seconds', () => {
    expect(formatMMSS(300_000)).toBe('05:00');
    expect(formatMMSS(539_001)).toBe('09:00');
    expect(formatMMSS(539_000)).toBe('08:59');
    expect(formatMMSS(3_600_000)).toBe('60:00');
    expect(formatMMSS(-5)).toBe('00:00');
  });
  it('formats a caption duration', () => {
    expect(formatMinutes(300_000)).toBe('5:00');
    expect(formatMinutes(90_000)).toBe('1:30');
  });
  it('formats a local wall-clock time', () => {
    expect(formatClock(new Date(2026, 9, 2, 9, 5).getTime())).toBe('09:05');
    expect(formatClock(new Date(2026, 9, 2, 12, 41).getTime())).toBe('12:41');
  });
});
