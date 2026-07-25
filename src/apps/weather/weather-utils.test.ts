import { describe, it, expect } from 'vitest';
import {
  parseLocalISO,
  minutesSinceMidnight,
  clockSlot,
  ringSlots,
  polar,
  dayProgress,
  rampColor,
} from './weather-utils';

describe('parseLocalISO', () => {
  it('reads a zone-less Open-Meteo timestamp as LOCAL, not UTC', () => {
    const d = parseLocalISO('2026-07-24T20:00');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July
    expect(d.getDate()).toBe(24);
    expect(d.getHours()).toBe(20);
    expect(d.getMinutes()).toBe(0);
  });

  it('handles a date-only string', () => {
    const d = parseLocalISO('2026-07-24');
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(24);
  });
});

describe('minutesSinceMidnight', () => {
  it('converts a local timestamp to minutes', () => {
    expect(minutesSinceMidnight('2026-07-24T05:29')).toBe(5 * 60 + 29);
    expect(minutesSinceMidnight('2026-07-24T20:32')).toBe(20 * 60 + 32);
  });
});

describe('clockSlot', () => {
  it('maps 24h hours onto 12 clock positions', () => {
    expect(clockSlot(0)).toBe(0);   // midnight at the top
    expect(clockSlot(12)).toBe(0);  // noon also at the top
    expect(clockSlot(17)).toBe(5);  // 17:00 sits on the 5 mark
    expect(clockSlot(23)).toBe(11);
  });

  it('handles negative hours', () => {
    expect(clockSlot(-1)).toBe(11);
    expect(clockSlot(-13)).toBe(11);
  });
});

describe('ringSlots', () => {
  it('places 12 consecutive hours into 12 distinct slots', () => {
    const hours = [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4].map((hour) => ({ hour }));
    const slots = ringSlots(hours);
    expect(slots).toHaveLength(12);
    expect(slots.every((s) => s !== null)).toBe(true);
    expect(slots[5]!.hour).toBe(17);
    expect(slots[0]!.hour).toBe(0);
    expect(slots[11]!.hour).toBe(23);
  });

  it('leaves gaps as null when fewer than 12 hours are supplied', () => {
    const slots = ringSlots([{ hour: 17 }, { hour: 18 }]);
    expect(slots[5]!.hour).toBe(17);
    expect(slots[6]!.hour).toBe(18);
    expect(slots[0]).toBeNull();
  });

  it('overwrites with the later hour when more than 12 hours collide on a slot', () => {
    const hours = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((hour) => ({ hour }));
    const slots = ringSlots(hours);
    expect(slots).toHaveLength(12);
    expect(slots[0]!.hour).toBe(12);
    expect(slots[1]!.hour).toBe(13);
  });
});

describe('polar', () => {
  it('puts slot 0 at the top and slot 3 at the right', () => {
    const top = polar(500, 500, 100, 0);
    expect(Math.round(top.x)).toBe(500);
    expect(Math.round(top.y)).toBe(400);

    const right = polar(500, 500, 100, 3);
    expect(Math.round(right.x)).toBe(600);
    expect(Math.round(right.y)).toBe(500);
  });
});

describe('dayProgress', () => {
  const sunrise = 5 * 60 + 29;
  const sunset = 20 * 60 + 32;

  it('is 0 at sunrise and 1 at sunset', () => {
    expect(dayProgress(sunrise, sunrise, sunset)).toBe(0);
    expect(dayProgress(sunset, sunrise, sunset)).toBe(1);
  });

  it('clamps outside daylight', () => {
    expect(dayProgress(60, sunrise, sunset)).toBe(0);
    expect(dayProgress(23 * 60, sunrise, sunset)).toBe(1);
  });

  it('is about 0.79 at 17:25', () => {
    expect(dayProgress(17 * 60 + 25, sunrise, sunset)).toBeCloseTo(0.794, 2);
  });
});

describe('rampColor', () => {
  const stops: Array<[number, string]> = [
    [0, '#000000'],
    [10, '#ffffff'],
  ];

  it('returns endpoint colours outside the range', () => {
    expect(rampColor(stops, -5)).toBe('#000000');
    expect(rampColor(stops, 99)).toBe('#ffffff');
  });

  it('interpolates in between', () => {
    expect(rampColor(stops, 5)).toBe('#808080');
  });

  it('expands 3-digit shorthand hex before interpolating', () => {
    const shorthand: Array<[number, string]> = [
      [0, '#000'],
      [10, '#fff'],
    ];
    expect(rampColor(shorthand, 5)).toBe('#808080');
  });
});
