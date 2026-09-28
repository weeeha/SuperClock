import { z } from 'zod';
import type { FieldMetaMap } from '../types';
import { handShadowSchema, handShadowMeta } from '../hand-shadow';

export const complicationsDarkFaceSchema = z.object({
  accent: z.string().default('#22c55e'),
  // none by default: black on a black dial contributes nothing (agent log
  // 2026-09-09).
  handShadow: handShadowSchema.default('none'),
});

export const complicationsDarkFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Sub-dial accents and highlights' },
  handShadow: handShadowMeta,
};

export type ComplicationsDarkFaceConfig = z.infer<typeof complicationsDarkFaceSchema>;
