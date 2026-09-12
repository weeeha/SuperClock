import { z } from 'zod';
import type { FieldMetaMap } from '../types';
import { handShadowField, handShadowFieldMeta } from './hand-shadow';

export const complicationsDarkFaceSchema = z.object({
  accent: z.string().default('#22c55e'),
  handShadow: handShadowField,
});

export const complicationsDarkFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Sub-dial accents and highlights' },
  handShadow: handShadowFieldMeta,
};

export type ComplicationsDarkFaceConfig = z.infer<typeof complicationsDarkFaceSchema>;
