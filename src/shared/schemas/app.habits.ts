import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const habitsAppSchema = z.object({
  weekStart: z.enum(['monday', 'sunday']).default('monday'),
  theme: z.enum(['auto', 'light', 'dark']).default('auto'),
});

export const habitsAppMeta: FieldMetaMap = {
  weekStart: { description: 'First day of the monthly ring' },
  theme: { description: 'auto = follow device theme setting' },
};

export type HabitsAppConfig = z.infer<typeof habitsAppSchema>;
