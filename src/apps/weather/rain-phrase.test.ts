import { describe, it, expect } from 'vitest';
import { rainPhrase } from './rain-phrase';
import type { HourSample, WeatherModel } from './weather-utils';

function hour(h: number, precipProb: number): HourSample {
  return { hour: h, temp: 14, apparent: 13, humidity: 60, precipProb, windSpeed: 10, windGust: 20, uv: 2, code: 3, isDay: true };
}

function model(code: number, probs: number[]): WeatherModel {
  const hours = probs.map((p, i) => hour(14 + i, p));
  return {
    current: { ...hours[0], code, windDir: 200 },
    today: { high: 16, low: 8, sunriseMin: 400, sunsetMin: 1100 },
    hours,
  };
}

describe('rainPhrase', () => {
  it('names the first wet hour when it is dry now', () => {
    expect(rainPhrase(model(3, [10, 60, 80, 90, 70, 30]))).toEqual({
      condition: 'Overcast',
      change: 'Rain from 15:00',
    });
  });

  it('names the first dry hour when it is raining now', () => {
    expect(rainPhrase(model(61, [80, 90, 70, 60, 40, 10]))).toEqual({
      condition: 'Rain',
      change: 'Clearing by 18:00',
    });
  });

  it('has no change line when nothing changes in the window', () => {
    expect(rainPhrase(model(0, [0, 0, 5, 10, 0, 0]))).toEqual({ condition: 'Clear', change: null });
    expect(rainPhrase(model(61, [80, 90, 95, 85, 70, 60]))).toEqual({ condition: 'Rain', change: null });
  });

  it('keeps the condition label as the model names it', () => {
    expect(rainPhrase(model(2, [0, 0, 0])).condition).toBe('Partly Cloudy');
  });

  it('treats 50% as wet', () => {
    expect(rainPhrase(model(3, [49, 50])).change).toBe('Rain from 15:00');
  });

  it('pads hours past midnight', () => {
    const m = model(3, [0, 0]);
    m.hours[1] = hour(2, 70);
    expect(rainPhrase(m).change).toBe('Rain from 02:00');
  });
});
