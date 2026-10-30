import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Neon Tube: one canvas-drawn neon face (src/apps/clock/neon/faces/tube.ts).
export const neonTubeFaceSchema = z.object({
  // How far the glow reaches. 'soft' keeps the tubes and their white cores
  // but pulls the halo in, for a dark bedroom.
  glow: z.enum(['full', 'soft']).default('full'),
});

export const neonTubeFaceMeta: FieldMetaMap = {
  glow: { description: 'Glow reach: full neon, or soft for a dark room' },
};

export type NeonTubeFaceConfig = z.infer<typeof neonTubeFaceSchema>;
