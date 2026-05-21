import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const fireplaceAppSchema = z.object({
  intensity: z.enum(['calm', 'medium', 'roaring']).default('medium'),
  hue: z.enum(['classic', 'cool', 'blue', 'purple']).default('classic'),
});

export const fireplaceAppMeta: FieldMetaMap = {
  intensity: { description: 'Particle spawn rate' },
  hue: { description: 'Tint of the flames' },
};

export type FireplaceAppConfig = z.infer<typeof fireplaceAppSchema>;
