import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const productivityFaceSchema = z.object({
  accent: z.string().default('#ffcc00'),
  showSeconds: z.boolean().default(true),
});

export const productivityFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Second-hand and highlight color' },
  showSeconds: { description: 'Render the second hand' },
};

export type ProductivityFaceConfig = z.infer<typeof productivityFaceSchema>;
