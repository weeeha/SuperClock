import { z } from 'zod';

export const temperatureComplicationSchema = z.object({
  unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  showCondition: z.boolean().default(true),
});

export type TemperatureComplicationConfig = z.infer<typeof temperatureComplicationSchema>;
