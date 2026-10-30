import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Neon Plasma: one canvas-drawn neon face (src/apps/clock/neon/faces/plasma.ts).
export const neonPlasmaFaceSchema = z.object({
  // How far the glow reaches. 'soft' keeps the tubes and their white cores
  // but pulls the halo in, for a dark bedroom.
  glow: z.enum(['full', 'soft']).default('full'),
});

export const neonPlasmaFaceMeta: FieldMetaMap = {
  glow: { description: 'Glow reach: full neon, or soft for a dark room' },
};

export type NeonPlasmaFaceConfig = z.infer<typeof neonPlasmaFaceSchema>;
