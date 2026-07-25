import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const daylightFaceSchema = z.object({
  // (0, 0) yields ~06:00/18:00 year-round — a neutral default rather than
  // an invented home location. Deliberately face config, not the weather
  // app's VITE_ env path (build-time inlined, admin can't change it).
  latitude: z.number().min(-90).max(90).default(0),
  longitude: z.number().min(-180).max(180).default(0),
  showTimes: z.boolean().default(true),
});

export const daylightFaceMeta: FieldMetaMap = {
  latitude: { min: -90, max: 90, step: 0.01, description: 'Degrees north (negative = south)' },
  longitude: { min: -180, max: 180, step: 0.01, description: 'Degrees east (negative = west)' },
  showTimes: { description: 'Sunrise and sunset time labels at the band ends' },
};

export type DaylightFaceConfig = z.infer<typeof daylightFaceSchema>;
