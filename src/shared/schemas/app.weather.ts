import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const WEATHER_PAGE_ENUM = ['now', 'temp', 'conditions', 'precip', 'wind', 'uv'] as const;

export const weatherAppSchema = z.object({
  location: z.string().default(''),
  unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  pages: z
    .array(z.enum(WEATHER_PAGE_ENUM))
    .min(1)
    .refine((p) => new Set(p).size === p.length, {
      message: 'pages must not contain duplicates',
    })
    .default([...WEATHER_PAGE_ENUM]),
  idleReturnSeconds: z.number().int().min(0).max(600).default(60),
});

export const weatherAppMeta: FieldMetaMap = {
  location: {
    // Wording kept from #36 — it names the geocoder, which is the part an
    // operator needs to know when a city name silently fails to resolve.
    description:
      'City name (geocoded via Open-Meteo) or "lat,lon" (e.g. "37.78,-122.42"). Falls back to env if blank.',
    placeholder: 'Montreal',
  },
  unit: { description: 'Temperature scale. Falls back to env if never set.' },
  pages: {
    description:
      'Which pages the vertical swipe cycles through, in order. "now" is the ambient resting page.',
  },
  idleReturnSeconds: {
    min: 0,
    max: 600,
    step: 10,
    description: 'Seconds of no touch before returning to the first page. 0 disables.',
  },
};

export type WeatherAppConfig = z.infer<typeof weatherAppSchema>;

/** Canonical page-id type. `src/apps/weather/*` imports this rather than
 *  redeclaring the list — `src/shared` must never import from `src/apps`. */
export type WeatherPageId = (typeof WEATHER_PAGE_ENUM)[number];
