import { describe, it, expect } from 'vitest';
import { RALLY_CARS, RALLY_WORLDS, rallyFaceSchema } from '../../../shared/schemas/face.rally';
import { BIOMES, lightForHour, roadX } from './worlds';

describe('rally worlds', () => {
  it('has exactly the worlds the schema offers', () => {
    expect(Object.keys(BIOMES).sort()).toEqual([...RALLY_WORLDS].sort());
  });

  it('only lets Auto pick cars that exist', () => {
    for (const b of Object.values(BIOMES)) for (const c of b.cars) expect(RALLY_CARS).toContain(c);
  });

  it('keeps rain out of both deserts', () => {
    expect(BIOMES.dunes.weathers).not.toContain('rain');
    expect(BIOMES.desert.weathers).not.toContain('rain');
  });

  it('drives the dunes on open sand', () => {
    expect(BIOMES.dunes.offroad).toBe(true);
  });

  it('grows the same road for the same distance', () => {
    expect(roadX(1234.5, 1)).toBe(roadX(1234.5, 1));
    expect(Math.abs(roadX(1234.5, 1))).toBeLessThanOrEqual(16);
  });

  it('follows the real clock for light', () => {
    expect(lightForHour(7)).toBe('morning');
    expect(lightForHour(12)).toBe('noon');
    expect(lightForHour(18)).toBe('sunset');
    expect(lightForHour(23)).toBe('night');
    expect(lightForHour(3)).toBe('night');
  });

  it('defaults to an all-auto stage at 130 km/h', () => {
    expect(rallyFaceSchema.parse({})).toEqual({ world: 'auto', weather: 'auto', light: 'real', car: 'auto', speed: 130, hour24: true });
  });
});
