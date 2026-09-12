import { z } from 'zod';
import type { FieldMetaMap } from '../types';
import { handShadowField, handShadowFieldMeta } from './hand-shadow';

// Minimalismo's look is its refusal: no ticks, no numerals, no centre dot, and
// a gold second hand that is not configurable. Its only option is the shadow.
export const minimalismoFaceSchema = z.object({
  handShadow: handShadowField,
});

export const minimalismoFaceMeta: FieldMetaMap = {
  handShadow: handShadowFieldMeta,
};

export type MinimalismoFaceConfig = z.infer<typeof minimalismoFaceSchema>;
