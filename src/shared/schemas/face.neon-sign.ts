import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Neon Sign: one canvas-drawn neon face (src/apps/clock/neon/faces/sign.ts).
export const neonSignFaceSchema = z.object({
  // How far the glow reaches. 'soft' keeps the tubes and their white cores
  // but pulls the halo in, for a dark bedroom.
  glow: z.enum(['full', 'soft']).default('full'),
});

export const neonSignFaceMeta: FieldMetaMap = {
  glow: { description: 'Glow reach: full neon, or soft for a dark room' },
};

export type NeonSignFaceConfig = z.infer<typeof neonSignFaceSchema>;
