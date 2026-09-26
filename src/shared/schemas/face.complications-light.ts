import { z } from 'zod';
import type { FieldMetaMap } from '../types';
import { handShadowSchema, handShadowMeta } from '../hand-shadow';

export const complicationsLightFaceSchema = z.object({
  accent: z.string().default('#22c55e'),
  // cast by default, replacing the per-frame blurred filter the hands
  // carried (agent log 2026-09-09).
  handShadow: handShadowSchema.default('cast'),
});

export const complicationsLightFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Sub-dial accents and highlights' },
  handShadow: handShadowMeta,
};

export type ComplicationsLightFaceConfig = z.infer<typeof complicationsLightFaceSchema>;
