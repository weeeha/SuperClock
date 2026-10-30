import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// The ids the face's world and garage data are keyed by
// (src/apps/clock/rally/worlds.ts and models.ts; rally.test.ts holds them equal).
export const RALLY_WORLDS = ['africa', 'desert', 'dunes', 'snow', 'city', 'plains', 'mountains', 'iceland'] as const;
export const RALLY_CARS = ['hatch', 'saloon', 'wedge', 'coupe', 'safari', 'mini', 'beetle'] as const;

export const rallyFaceSchema = z.object({
  // Auto drives through every world in turn, a new one every ten minutes.
  world: z.enum(['auto', ...RALLY_WORLDS]).default('auto'),
  // Auto rolls a new sky every 30 s from what the current world allows.
  weather: z.enum(['auto', 'clear', 'clouds', 'rain', 'snow']).default('auto'),
  // Real follows the clock; the kiosk's night palette always wins and drives at night.
  light: z.enum(['real', 'cycle', 'morning', 'noon', 'sunset', 'night']).default('real'),
  // Auto picks a car that suits the world, a new one every minute.
  car: z.enum(['auto', ...RALLY_CARS]).default('auto'),
  speed: z.number().min(40).max(250).default(130),
  hour24: z.boolean().default(true),
});

export const rallyFaceMeta: FieldMetaMap = {
  world: { description: 'Where the stage runs. Auto changes world every ten minutes.' },
  weather: { description: 'Auto rolls a new sky every 30 seconds from what the world allows (no rain in the dunes).' },
  light: { description: 'Real follows the time of day; cycle steps through morning, noon, sunset and night. Night mode always drives at night.' },
  car: { description: 'Auto picks a car that suits the world and changes it every minute.' },
  speed: { min: 40, max: 250, step: 10, description: 'Cruising speed in km/h on straights; the car brakes for bends.' },
  hour24: { description: '24-hour clock (on) or 12-hour (off)' },
};

export type RallyFaceConfig = z.infer<typeof rallyFaceSchema>;
