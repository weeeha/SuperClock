import { z } from 'zod';
import type { FieldMetaMap } from '../types';
import { handShadowSchema, handShadowMeta } from '../hand-shadow';

export const floralFaceSchema = z.object({
  // Default = the hand colour the face has always drawn, so an unconfigured
  // instance looks exactly as before the schema was wired.
  accent: z.string().default('#fbbf24'),
  // cast by default: white hands over a bright field (agent log 2026-09-09).
  handShadow: handShadowSchema.default('cast'),
});

export const floralFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Hand color over the artwork' },
  handShadow: handShadowMeta,
};

export type FloralFaceConfig = z.infer<typeof floralFaceSchema>;
