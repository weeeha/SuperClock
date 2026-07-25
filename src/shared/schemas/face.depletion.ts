import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const depletionFaceSchema = z.object({
  // 'awake' spans the hours outside the device's settings.night window
  // (no window configured -> behaves as calendar-day).
  cycle: z.enum(['calendar-day', 'awake']).default('calendar-day'),
  ticks: z.enum(['hours', 'quarters', 'none']).default('hours'),
  readout: z.enum(['remaining', 'none']).default('remaining'),
});

export const depletionFaceMeta: FieldMetaMap = {
  cycle: {
    description:
      'calendar-day drains to local midnight; awake drains to the night window opening',
  },
  ticks: { description: '24 hour marks, 4 quarter marks, or a bare disc' },
  readout: { description: 'The "6H 12M LEFT" line inside the spent area' },
};

export type DepletionFaceConfig = z.infer<typeof depletionFaceSchema>;
