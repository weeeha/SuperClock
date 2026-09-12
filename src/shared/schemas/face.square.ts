import { z } from 'zod';
import type { FieldMetaMap } from '../types';
import { handShadowField, handShadowFieldMeta } from './hand-shadow';

export const squareFaceSchema = z.object({
  // Default = the colour the face has always drawn (sub-dial ring + hub), so an
  // unconfigured instance looks exactly as before the schema was wired.
  accent: z.string().default('#e94560'),
  handShadow: handShadowField,
});

export const squareFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Sub-dial accent color' },
  handShadow: handShadowFieldMeta,
};

export type SquareFaceConfig = z.infer<typeof squareFaceSchema>;
