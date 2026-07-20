import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const analogFaceSchema = z.object({
  // Default matches the face's historical second-hand gold, so devices
  // without saved face options look exactly as before.
  accent: z.string().default('#FFD700'),
  numeralStyle: z.enum(['none', 'arabic', 'roman']).default('none'),
  showSeconds: z.boolean().default(true),
});

export const analogFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Second-hand and center-dot color' },
  numeralStyle: { description: 'How the hour numerals are drawn' },
  showSeconds: { description: 'Render the second hand' },
};

export type AnalogFaceConfig = z.infer<typeof analogFaceSchema>;
