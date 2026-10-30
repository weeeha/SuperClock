import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Neon Horizon: one canvas-drawn neon face (src/apps/clock/neon/faces/horizon.ts).
export const neonHorizonFaceSchema = z.object({
  // How far the glow reaches. 'soft' keeps the tubes and their white cores
  // but pulls the halo in, for a dark bedroom.
  glow: z.enum(['full', 'soft']).default('full'),
});

export const neonHorizonFaceMeta: FieldMetaMap = {
  glow: { description: 'Glow reach: full neon, or soft for a dark room' },
};

export type NeonHorizonFaceConfig = z.infer<typeof neonHorizonFaceSchema>;
