import { z } from 'zod';
import type { FieldMetaMap } from '../types';
import { handShadowField, handShadowFieldMeta } from './hand-shadow';

export const floralFaceSchema = z.object({
  // Default = the hand colour the face has always drawn, so an unconfigured
  // instance looks exactly as before the schema was wired.
  accent: z.string().default('#fbbf24'),
  handShadow: handShadowField,
});

export const floralFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Hand color over the artwork' },
  handShadow: handShadowFieldMeta,
};

export type FloralFaceConfig = z.infer<typeof floralFaceSchema>;
