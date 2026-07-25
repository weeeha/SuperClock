import { describe, it, expect } from 'vitest';
import { weatherAppSchema } from './app.weather';

describe('weatherAppSchema', () => {
  it('defaults to all six pages enabled', () => {
    const cfg = weatherAppSchema.parse({});
    expect(cfg.pages).toEqual(['now', 'temp', 'conditions', 'precip', 'wind', 'uv']);
    expect(cfg.unit).toBe('celsius');
    expect(cfg.location).toBe('');
    expect(cfg.idleReturnSeconds).toBe(60);
  });

  it('accepts a trimmed page list', () => {
    const cfg = weatherAppSchema.parse({ pages: ['now', 'temp', 'precip'] });
    expect(cfg.pages).toEqual(['now', 'temp', 'precip']);
  });

  it('rejects an unknown page id', () => {
    expect(weatherAppSchema.safeParse({ pages: ['now', 'moon'] }).success).toBe(false);
  });

  it('drops the retired forecastDays key', () => {
    const cfg = weatherAppSchema.parse({ forecastDays: 4 }) as Record<string, unknown>;
    expect(cfg.forecastDays).toBeUndefined();
  });

  it('treats idleReturnSeconds 0 as a valid disable', () => {
    expect(weatherAppSchema.parse({ idleReturnSeconds: 0 }).idleReturnSeconds).toBe(0);
  });
});
