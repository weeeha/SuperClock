import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const strokesFaceSchema = z.object({
  format: z.enum(['24', '12']).default('24'),
});

export const strokesFaceMeta: FieldMetaMap = {
  format: {
    description: '24-hour or 12-hour digits; 12-hour parks the leading-zero block',
  },
};

export type StrokesFaceConfig = z.infer<typeof strokesFaceSchema>;
