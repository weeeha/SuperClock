import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const breathingAppSchema = z.object({
  showDistance: z.boolean().default(true),
});

export const breathingAppMeta: FieldMetaMap = {
  showDistance: { description: 'Show the measured distance below the ring' },
};

export type BreathingAppConfig = z.infer<typeof breathingAppSchema>;
