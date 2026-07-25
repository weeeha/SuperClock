import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const weatherAppSchema = z.object({
  location: z.string().default(''),
  unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  forecastDays: z.number().int().min(1).max(7).default(4),
});

export const weatherAppMeta: FieldMetaMap = {
  location: {
    description:
      'City name (geocoded via Open-Meteo) or "lat,lon" (e.g. "37.78,-122.42"). Falls back to env if blank.',
    placeholder: 'San Francisco',
  },
  unit: { description: 'Temperature scale. Falls back to env if never set.' },
  forecastDays: {
    min: 1,
    max: 7,
    step: 1,
    // Matches Open-Meteo's `forecast_days`: today is the big reading up top,
    // so the strip below shows forecastDays - 1 tiles.
    description: 'Days of forecast including today; the strip shows the rest (4 = a 3-day strip)',
  },
};

export type WeatherAppConfig = z.infer<typeof weatherAppSchema>;
