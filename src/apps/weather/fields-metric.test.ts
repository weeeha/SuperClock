import { describe, it, expect } from 'vitest';
import { fieldsMetric } from './fields-metric';
import type { HourSample, WeatherModel } from './weather-utils';

const PRECIP = [10, 60, 80, 90, 70, 30, 20, 10, 5, 0, 0, 0];
const TEMPS = [14, 15, 15, 13, 12, 11, 10, 10, 9, 9, 8, 8];
const WIND = [12, 14, 18, 22, 20, 16, 12, 10, 8, 8, 6, 6];
const UV = [2, 3, 4, 4, 3, 2, 1, 0, 0, 0, 0, 0];

const MODEL: WeatherModel = (() => {
  const hours: HourSample[] = PRECIP.map((p, i) => ({
    hour: (14 + i) % 24, temp: TEMPS[i], apparent: TEMPS[i] - 2, humidity: 60, precipProb: p,
    windSpeed: WIND[i], windGust: WIND[i] + 10, uv: UV[i], code: p >= 50 ? 61 : 3, isDay: 14 + i < 19,
  }));
  return { current: { ...hours[0], windDir: 225 }, today: { high: 16, low: 8, sunriseMin: 400, sunsetMin: 1100 }, hours };
})();

describe('fieldsMetric', () => {
  it('temperature: hero, feels-like, H/L and a dot series (degrees have no zero baseline)', () => {
    const m = fieldsMetric('temp', MODEL);
    expect([m.title, m.hero, m.headline, m.subline]).toEqual(['Temperature', '14°', 'Feels like 12°', 'H:16°   L:8°']);
    expect(m.chart.kind).toBe('dots');
    expect(m.chart.values).toEqual(TEMPS);
    expect(m.chart.valueLabels).toEqual(['14°', null, null, '13°', null, null, '10°', null, null, '9°', null, null]);
  });

  it('labels the hours every third column, starting with Now', () => {
    expect(fieldsMetric('temp', MODEL).chart.hourLabels)
      .toEqual(['Now', null, null, '17', null, null, '20', null, null, '23', null, null]);
  });

  it('rain: chance now, the change line, the peak, cyan bars from 50% on a 0-100 scale', () => {
    const m = fieldsMetric('precip', MODEL);
    expect([m.title, m.hero, m.headline, m.subline]).toEqual(['Rain', '10%', 'Rain from 15:00', 'Peaks at 90% around 17:00']);
    expect(m.chart).toMatchObject({ kind: 'bars', values: PRECIP, max: 100, accent: 'drop', accentFrom: 50 });
  });

  it('rain with no change in the window says so plainly', () => {
    const dry = { ...MODEL, current: { ...MODEL.current, precipProb: 0 }, hours: MODEL.hours.map((h) => ({ ...h, precipProb: 0 })) };
    expect(fieldsMetric('precip', dry).headline).toBe('No rain expected');
  });

  it('wind: speed, unit and direction, gusts, bars', () => {
    const m = fieldsMetric('wind', MODEL);
    expect([m.title, m.hero, m.headline, m.subline]).toEqual(['Wind', '12', 'km/h  SW', 'Gusts to 22 km/h']);
    expect(m.chart).toMatchObject({ kind: 'bars', values: WIND, max: 40 });
    const gale = { ...MODEL, hours: MODEL.hours.map((h) => ({ ...h, windSpeed: 65 })) };
    expect(fieldsMetric('wind', gale).chart.max).toBe(65); // a gale stretches the scale
  });

  it('UV: index, band, peak, yellow bars from 3', () => {
    const m = fieldsMetric('uv', MODEL);
    expect([m.title, m.hero, m.headline, m.subline]).toEqual(['UV index', '2', 'Low', 'Peak today 4']);
    expect(m.chart).toMatchObject({ kind: 'bars', values: UV, max: 11, accent: 'sun', accentFrom: 3 });
  });

  it('conditions: a mark per hour from the model’s own codes', () => {
    const m = fieldsMetric('conditions', MODEL);
    expect([m.title, m.hero, m.headline]).toEqual(['Conditions', '14°', 'Overcast']);
    expect(m.chart.kind).toBe('marks');
    expect(m.chart.marks?.slice(0, 6)).toEqual(['cloud', 'rain', 'rain', 'rain', 'rain', 'cloud']);
  });

  it('the Now column takes the current reading, not the top-of-hour sample', () => {
    const later = { ...MODEL, current: { ...MODEL.current, temp: 17, windSpeed: 9, code: 0 } };
    expect(fieldsMetric('temp', later).chart.values.slice(0, 2)).toEqual([17, 15]);
    expect(fieldsMetric('wind', later).chart.values[0]).toBe(9);
    expect(fieldsMetric('conditions', later).chart.marks?.[0]).toBe('sun');
    expect(fieldsMetric('temp', later).chart.hourLabels[0]).toBe('Now');
  });
});
