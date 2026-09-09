import { describe, it, expect } from 'vitest';
import { dialFor, uvLabel } from './dials';
import type { HourSample, WeatherModel } from './weather-utils';

function hour(h: number, over: Partial<HourSample> = {}): HourSample {
  return {
    hour: h, temp: 20, apparent: 21, humidity: 50, precipProb: 0,
    windSpeed: 11, windGust: 21, uv: 0, code: 1, isDay: true, ...over,
  };
}

function model(over: Partial<WeatherModel> = {}): WeatherModel {
  return {
    current: {
      hour: 17, temp: 27, apparent: 28, humidity: 51, code: 1,
      windSpeed: 11, windDir: 234, windGust: 21, uv: 2, precipProb: 0, isDay: true,
    },
    today: { high: 27, low: 15, sunriseMin: 329, sunsetMin: 1232 },
    hours: [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4].map((h) => hour(h)),
    ...over,
  };
}

describe('uvLabel', () => {
  it('follows the WHO bands', () => {
    expect(uvLabel(0)).toBe('Low');
    expect(uvLabel(2)).toBe('Low');
    expect(uvLabel(3)).toBe('Moderate');
    expect(uvLabel(5)).toBe('Moderate');
    expect(uvLabel(6)).toBe('High');
    expect(uvLabel(7)).toBe('High');
    expect(uvLabel(8)).toBe('Very High');
    expect(uvLabel(10)).toBe('Very High');
    expect(uvLabel(11)).toBe('Extreme');
    expect(uvLabel(15)).toBe('Extreme');
  });
});

describe('dialFor', () => {
  it('returns null for the now page, which is not a dial', () => {
    expect(dialFor('now', model())).toBeNull();
  });

  it('formats the temperature dial', () => {
    const d = dialFor('temp', model())!;
    expect(d.centre).toBe('27°');
    expect(d.sub).toBe('Feels like 28°');
    expect(d.valueOf(hour(18, { temp: 25 }))).toBe('25°');
    expect(d.nowHour).toBe(17);
    expect(d.hours).toHaveLength(12);
  });

  it('formats the conditions dial with drawn marks, not text values', () => {
    const d = dialFor('conditions', model())!;
    expect(d.centre).toBe('27°');
    expect(d.sub).toBe('Mostly Clear');
    // The one dial whose value is a shape: it supplies markOf, and its
    // valueOf is empty so the ring draws nothing textual behind the mark.
    expect(d.markOf).toBeDefined();
    expect(d.markOf!(hour(2, { code: 0, isDay: false }))).toBe('moon');
    expect(d.markOf!(hour(14, { code: 0, isDay: true }))).toBe('sun');
    expect(d.valueOf(hour(2, { code: 0, isDay: false }))).toBe('');
  });

  it('leaves every other dial on text values', () => {
    for (const page of ['temp', 'precip', 'wind', 'uv'] as const) {
      expect(dialFor(page, model())!.markOf, `${page} should not draw marks`).toBeUndefined();
    }
  });

  it('formats the precipitation dial and names the peak hour', () => {
    const m = model({
      hours: [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4].map((h) =>
        hour(h, { precipProb: h === 23 ? 25 : 0 })),
    });
    const d = dialFor('precip', m)!;
    expect(d.centre).toBe('0%');
    expect(d.sub).toBe('Chance now');
    expect(d.caption).toContain('25%');
    expect(d.caption).toContain('23:00');
    expect(d.valueOf(hour(1, { precipProb: 40 }))).toBe('40%');
  });

  it('says so when no precipitation is expected', () => {
    const d = dialFor('precip', model())!;
    expect(d.caption).toBe('None expected in 12h');
  });

  it('formats the wind dial with a compass direction', () => {
    const d = dialFor('wind', model())!;
    expect(d.centre).toBe('11');
    expect(d.sub).toContain('km/h');
    expect(d.sub).toContain('SW');
    expect(d.caption).toBe('Gusts to 21 km/h');
    expect(d.valueOf(hour(18, { windSpeed: 9 }))).toBe('9');
  });

  it('formats the UV dial and reports the daily peak', () => {
    const m = model({
      hours: [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4].map((h) =>
        hour(h, { uv: h === 17 ? 4 : 0 })),
    });
    const d = dialFor('uv', m)!;
    expect(d.centre).toBe('2');
    expect(d.sub).toBe('Low');
    expect(d.caption).toBe('Peak today 4');
  });

  it('gives every dial a colour for every hour', () => {
    for (const page of ['temp', 'conditions', 'precip', 'wind', 'uv'] as const) {
      const d = dialFor(page, model())!;
      for (const h of d.hours) {
        expect(d.colorOf(h)).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
