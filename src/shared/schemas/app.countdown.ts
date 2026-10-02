import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Dates are plain 'YYYY-MM-DD' strings so an empty or malformed value degrades
// to the "Not set up" screen instead of failing safeParse and reverting the
// whole config. label is born with its cap: narrowing a bound later is a
// breaking change under the schema snapshot gate.
export const countdownAppSchema = z.object({
  label: z.string().max(40).default(''),
  targetDate: z.string().default(''),
  style: z.enum(['days', 'weeks', 'progress-ring']).default('days'),
  startDate: z.string().default(''),
});

export const countdownAppMeta: FieldMetaMap = {
  label: { description: 'What the date is, shown under the number. Up to 40 characters.', placeholder: 'Tokyo' },
  targetDate: { format: 'date', label: 'Target date' },
  style: { description: 'Days, weeks plus days, or days with a ring showing how much of the wait has passed' },
  startDate: {
    format: 'date',
    label: 'Start date',
    description: 'Where the progress ring starts. Without it the ring is not drawn.',
    showIf: (v) => v.style === 'progress-ring',
  },
};

export type CountdownAppConfig = z.infer<typeof countdownAppSchema>;
