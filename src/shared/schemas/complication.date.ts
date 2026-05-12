import { z } from 'zod';

export const dateComplicationSchema = z.object({
  format: z.enum(['day-month', 'weekday-day', 'iso']).default('day-month'),
});

export type DateComplicationConfig = z.infer<typeof dateComplicationSchema>;
