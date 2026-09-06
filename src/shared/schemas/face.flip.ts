import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const flipFaceSchema = z.object({
  // Default = the white digits the face has always drawn, so an unconfigured
  // instance looks exactly as before the schema was wired.
  accent: z.string().default('#ffffff'),
  hour24: z.boolean().default(true),
});

export const flipFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Digit color' },
  hour24: { description: '24-hour clock (on) or 12-hour with AM/PM (off)' },
};

export type FlipFaceConfig = z.infer<typeof flipFaceSchema>;
