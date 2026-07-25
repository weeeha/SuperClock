import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const apertureFaceSchema = z.object({
  format: z.enum(['24h', '12h']).default('24h'),
  showDate: z.boolean().default(true),
  // Off makes the face fully static between minute steps — the
  // lowest-power face in the fleet.
  secondsBar: z.boolean().default(true),
});

export const apertureFaceMeta: FieldMetaMap = {
  format: { description: '12h adds a small AM/PM tag beside the hour window' },
  showDate: { description: 'Date line under the minute window' },
  secondsBar: { description: 'Accent bar filling across the current minute' },
};

export type ApertureFaceConfig = z.infer<typeof apertureFaceSchema>;
