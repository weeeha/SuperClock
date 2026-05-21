import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const complicationsLightFaceSchema = z.object({
  accent: z.string().default('#22c55e'),
});

export const complicationsLightFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Sub-dial accents and highlights' },
};

export type ComplicationsLightFaceConfig = z.infer<typeof complicationsLightFaceSchema>;
