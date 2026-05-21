import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const analogFaceSchema = z.object({
  accent: z.string().default('#ff6b35'),
  numeralStyle: z.enum(['none', 'arabic', 'roman']).default('arabic'),
  showSeconds: z.boolean().default(true),
});

export const analogFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Hour-hand and tick color' },
  numeralStyle: { description: 'How the hour markers are drawn' },
  showSeconds: { description: 'Render the second hand' },
};

export type AnalogFaceConfig = z.infer<typeof analogFaceSchema>;
