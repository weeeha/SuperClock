import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const flipFaceSchema = z.object({
  accent: z.string().default('#f97316'),
  hour24: z.boolean().default(true),
});

export const flipFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Digit color' },
  hour24: { description: '24-hour clock (on) or 12-hour with AM/PM (off)' },
};

export type FlipFaceConfig = z.infer<typeof flipFaceSchema>;
