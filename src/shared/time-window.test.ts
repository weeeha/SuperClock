import { describe, it, expect } from 'vitest';
import { isWithinWindow } from './time-window';

// Local-time Date at HH:MM — isWithinWindow reads wall-clock hours/minutes.
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 5, 15, h, m, 0);
}

describe('isWithinWindow', () => {
  describe('same-day window (09:00 → 17:00)', () => {
    const w = { start: '09:00', end: '17:00' };
    it.each([
      ['08:59', false],
      ['09:00', true], // start is inclusive
      ['12:00', true],
      ['16:59', true],
      ['17:00', false], // end is exclusive
      ['23:00', false],
      ['00:00', false],
    ])('%s → %s', (time, expected) => {
      expect(isWithinWindow(w, at(time))).toBe(expected);
    });
  });

  describe('window wrapping past midnight (21:00 → 07:00)', () => {
    const w = { start: '21:00', end: '07:00' };
    it.each([
      ['20:59', false],
      ['21:00', true],
      ['23:59', true],
      ['00:00', true],
      ['03:00', true],
      ['06:59', true],
      ['07:00', false],
      ['12:00', false],
    ])('%s → %s', (time, expected) => {
      expect(isWithinWindow(w, at(time))).toBe(expected);
    });
  });

  it('start === end is never active (documented contract)', () => {
    expect(isWithinWindow({ start: '10:00', end: '10:00' }, at('10:00'))).toBe(false);
    expect(isWithinWindow({ start: '10:00', end: '10:00' }, at('22:00'))).toBe(false);
  });

  it('missing window is never active', () => {
    expect(isWithinWindow(undefined, at('12:00'))).toBe(false);
  });

  it.each([
    ['25:00', '07:00'],
    ['21:00', '07:60'],
    ['9am', '5pm'],
    ['', ''],
  ])('malformed times (%s → %s) are never active', (start, end) => {
    expect(isWithinWindow({ start, end }, at('12:00'))).toBe(false);
  });

  it('accepts single-digit hours', () => {
    expect(isWithinWindow({ start: '9:00', end: '17:00' }, at('10:00'))).toBe(true);
  });
});
