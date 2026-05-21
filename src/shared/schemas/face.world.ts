import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const worldFaceSchema = z.object({
  accent: z.string().default('#3b82f6'),
  primaryTimezone: z.string().default('local'),
});

export const worldFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Highlight color for the primary dial' },
  primaryTimezone: {
    description: 'IANA timezone (e.g. America/Los_Angeles) or "local" for the device clock',
    placeholder: 'local',
  },
};

export type WorldFaceConfig = z.infer<typeof worldFaceSchema>;
