import { describe, it, expect, vi } from 'vitest';
import {
  parseLocalISO,
  minutesSinceMidnight,
  clockSlot,
  ringSlots,
  polar,
  dayProgress,
  rampColor,
  parseForecast,
  codeGlyph,
  conditionLabel,
  compass,
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

/** Trimmed but structurally exact Open-Meteo payload. 36 hourly entries so the
 *  12-hour window starting at 17:00 runs off the end of day one. */
function fixture() {
  const time: string[] = [];
  for (let hh = 0; hh < 24; hh++) time.push(`2026-07-24T${String(hh).padStart(2, '0')}:00`);
  for (let hh = 0; hh < 12; hh++) time.push(`2026-07-25T${String(hh).padStart(2, '0')}:00`);
  const n = time.length;
  const seq = (f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));
  return {
    utc_offset_seconds: -14400,
    current: {
      time: '2026-07-24T17:00',
      temperature_2m: 27.4,
      apparent_temperature: 28.1,
      relative_humidity_2m: 51,
      weather_code: 1,
      wind_speed_10m: 11.2,
      wind_direction_10m: 234,
      wind_gusts_10m: 21.3,
      uv_index: 2.4,
      precipitation_probability: 0,
      is_day: 1,
    },
    hourly: {
      time,
      temperature_2m: seq((i) => 20 + (i % 12)),
      apparent_temperature: seq((i) => 21 + (i % 12)),
      relative_humidity_2m: seq(() => 50),
      precipitation_probability: seq((i) => i % 30),
      wind_speed_10m: seq(() => 11),
      wind_gusts_10m: seq(() => 21),
      uv_index: seq((i) => (i % 12) / 4),
      weather_code: seq(() => 1),
      is_day: seq((i) => (i % 24 >= 6 && i % 24 < 20 ? 1 : 0)),
    },
    daily: {
      time: ['2026-07-24', '2026-07-25'],
      temperature_2m_max: [27, 29],
      temperature_2m_min: [15, 17],
      sunrise: ['2026-07-24T05:29', '2026-07-25T05:30'],
      sunset: ['2026-07-24T20:32', '2026-07-25T20:31'],
    },
  };
}

describe('parseForecast', () => {
  const now = new Date(2026, 6, 24, 17, 25, 0);

  it('returns exactly 12 hours starting at the current hour', () => {
    const m = parseForecast(fixture(), now);
    expect(m.hours).toHaveLength(12);
    expect(m.hours[0].hour).toBe(17);
    expect(m.hours.map((h) => h.hour)).toEqual([17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4]);
  });

  it('rounds current readings and keeps wind direction', () => {
    const m = parseForecast(fixture(), now);
    expect(m.current.temp).toBe(27);
    expect(m.current.apparent).toBe(28);
    expect(m.current.humidity).toBe(51);
    expect(m.current.windSpeed).toBe(11);
    expect(m.current.windGust).toBe(21);
    expect(m.current.windDir).toBe(234);
    expect(m.current.uv).toBe(2);
    expect(m.current.isDay).toBe(true);
  });

  it('reads today high/low and sunrise/sunset as local minutes', () => {
    const m = parseForecast(fixture(), now);
    expect(m.today.high).toBe(27);
    expect(m.today.low).toBe(15);
    expect(m.today.sunriseMin).toBe(5 * 60 + 29);
    expect(m.today.sunsetMin).toBe(20 * 60 + 32);
  });

  it('crosses midnight into the next forecast day', () => {
    const m = parseForecast(fixture(), now);
    const past = m.hours.slice(7);
    expect(past.map((h) => h.hour)).toEqual([0, 1, 2, 3, 4]);
    expect(past.every((h) => !h.isDay)).toBe(true);
  });

  it('falls back to the first hour when the current hour is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = fixture();
    const m = parseForecast(f, new Date(2026, 0, 1, 3, 0, 0));
    expect(m.hours).toHaveLength(12);
    expect(m.hours[0].hour).toBe(0);
    warn.mockRestore();
  });

  it('throws on a missing current field', () => {
    const f = fixture();
    delete (f.current as Record<string, unknown>).uv_index;
    expect(() => parseForecast(f, now)).toThrow(/uv_index/);
  });

  it('throws on a missing hourly field', () => {
    const f = fixture();
    delete (f.hourly as Record<string, unknown>).wind_speed_10m;
    expect(() => parseForecast(f, now)).toThrow(/wind_speed_10m/);
  });

  it('warns when the current hour is absent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = fixture();
    parseForecast(f, new Date(2026, 0, 1, 3, 0, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('codeGlyph', () => {
  it('uses day and night variants for clear skies', () => {
    expect(codeGlyph(0, true)).toBe('☀');
    expect(codeGlyph(0, false)).toBe('☾');
  });

  it('maps WMO ranges to glyph families', () => {
    expect(codeGlyph(3, true)).toBe('☁');
    expect(codeGlyph(61, true)).toBe('🌧');
    expect(codeGlyph(71, true)).toBe('❄');
    expect(codeGlyph(95, true)).toBe('⛈');
  });
});

describe('conditionLabel', () => {
  it('names the common codes', () => {
    expect(conditionLabel(0)).toBe('Clear');
    expect(conditionLabel(2)).toBe('Partly Cloudy');
    expect(conditionLabel(95)).toBe('Thunderstorm');
  });
});

describe('compass', () => {
  it('converts bearings to 8-point names', () => {
    expect(compass(0)).toBe('N');
    expect(compass(90)).toBe('E');
    expect(compass(234)).toBe('SW');
    expect(compass(359)).toBe('N');
  });
});
