import { z } from 'zod';
import type { FieldMetaMap } from '../types';
import { handShadowSchema, handShadowMeta } from '../hand-shadow';

export const productivityFaceSchema = z.object({
  // Default = the orange the face has always drawn for its digital time,
  // second hand and hub, so an unconfigured instance looks exactly as before.
  accent: z.string().default('#ff8826'),
  showSeconds: z.boolean().default(true),
  // cast by default: the hands cross the rim segments (agent log 2026-09-09).
  handShadow: handShadowSchema.default('cast'),
});

export const productivityFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Second-hand and highlight color' },
  showSeconds: { description: 'Render the second hand' },
  handShadow: handShadowMeta,
};

export type ProductivityFaceConfig = z.infer<typeof productivityFaceSchema>;
