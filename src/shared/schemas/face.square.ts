import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const squareFaceSchema = z.object({
  // Default = the colour the face has always drawn (sub-dial ring + hub), so an
  // unconfigured instance looks exactly as before the schema was wired.
  accent: z.string().default('#e94560'),
});

export const squareFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Sub-dial accent color' },
};

export type SquareFaceConfig = z.infer<typeof squareFaceSchema>;
