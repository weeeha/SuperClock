import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const productivityFaceSchema = z.object({
  // Default = the orange the face has always drawn for its digital time,
  // second hand and hub, so an unconfigured instance looks exactly as before.
  accent: z.string().default('#ff8826'),
  showSeconds: z.boolean().default(true),
});

export const productivityFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Second-hand and highlight color' },
  showSeconds: { description: 'Render the second hand' },
};

export type ProductivityFaceConfig = z.infer<typeof productivityFaceSchema>;
