import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const weatherAppSchema = z.object({
  location: z.string().default(''),
  unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  forecastDays: z.number().int().min(1).max(7).default(4),
});

export const weatherAppMeta: FieldMetaMap = {
  location: {
    description: 'City name or "lat,lon" (e.g. "37.78,-122.42"). Falls back to env if blank.',
    placeholder: 'San Francisco',
  },
  unit: {},
  forecastDays: { min: 1, max: 7, step: 1, description: 'How many days to show in the forecast strip' },
};

export type WeatherAppConfig = z.infer<typeof weatherAppSchema>;
