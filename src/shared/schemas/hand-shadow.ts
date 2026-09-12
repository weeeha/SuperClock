import { z } from 'zod';
import type { FieldMeta } from '../types';

/** The hand-shadow option, written once and shared by every hand-bearing face
 *  that carries it. An enum rather than a boolean: the fleet spans one Pi 5
 *  and three Pi 4s, and `soft` costs a blurred filter region every frame while
 *  `cast` costs one extra draw call.
 *
 *  Strokes deliberately does NOT carry this field: it is a lattice of 52
 *  two-hand dials, so `cast` there is 104 offset hands, which is a
 *  measurement nobody has taken on a Pi 4. */
export const handShadowField = z.enum(['none', 'cast', 'soft']).default('cast');

/** The three treatments, derived from the field so the component and the
 *  contract cannot drift apart. */
export type HandShadowMode = z.infer<typeof handShadowField>;

export const handShadowFieldMeta: FieldMeta = {
  description: 'Hand shadow: cast (offset, cheap), soft (blurred, fastclock only), or none',
};
