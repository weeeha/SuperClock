// Pure timezone math for WorldClock's primaryTimezone option. Pinned here so
// the face's React wiring can stay a one-liner and an invalid IANA string from
// the admin form degrades to the device clock instead of throwing at render.

import { describe, it, expect } from 'vitest';
import { resolveTimezone, handDegreesInTimezone } from './world-time';

describe('resolveTimezone', () => {
  it('returns null for "local" (the device clock drives the primary dial)', () => {
    expect(resolveTimezone('local')).toBeNull();
  });

  it('returns null for an empty or whitespace string', () => {
    expect(resolveTimezone('')).toBeNull();
    expect(resolveTimezone('   ')).toBeNull();
  });

  it('returns the trimmed IANA name when Intl accepts it', () => {
    expect(resolveTimezone(' Asia/Tokyo ')).toBe('Asia/Tokyo');
  });

  it('returns null for an IANA name Intl rejects (never throws at render)', () => {
    expect(resolveTimezone('Nowhere/Land')).toBeNull();
  });
});

describe('handDegreesInTimezone', () => {
  // 2026-09-05T03:30:15Z is 12:30:15 in Tokyo (UTC+9, no DST).
  const at = new Date('2026-09-05T03:30:15Z');

  it('minute hand includes the seconds fraction, like useClockHands', () => {
    const { minuteDeg } = handDegreesInTimezone(at, 'Asia/Tokyo');
    expect(minuteDeg).toBeCloseTo((30 + 15 / 60) * 6, 6);
  });

  it('hour hand uses the 12-hour dial with the minute fraction', () => {
    const { hourDeg } = handDegreesInTimezone(at, 'Asia/Tokyo');
    // 12:30 → hour 0 on the dial plus half an hour → 15 degrees.
    expect(hourDeg).toBeCloseTo((0 + 30 / 60) * 30, 6);
  });

  it('differs between zones by their offset', () => {
    const tokyo = handDegreesInTimezone(at, 'Asia/Tokyo');
    const london = handDegreesInTimezone(at, 'Europe/London'); // 04:30:15 BST
    expect(london.hourDeg).toBeCloseTo((4 + 30 / 60) * 30, 6);
    expect(london.minuteDeg).toBeCloseTo(tokyo.minuteDeg, 6);
  });
});
