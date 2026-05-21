import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const complicationsDarkFaceSchema = z.object({
  accent: z.string().default('#22c55e'),
});

export const complicationsDarkFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Sub-dial accents and highlights' },
};

export type ComplicationsDarkFaceConfig = z.infer<typeof complicationsDarkFaceSchema>;
