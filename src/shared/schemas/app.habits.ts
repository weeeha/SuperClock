import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const habitsAppSchema = z.object({
  // Default mirrors the list HabitsApp historically hardcoded — ids (and thus
  // localStorage completion keys) derive from these names, so don't reword them.
  habits: z
    .array(z.string())
    .default(['Health', 'Read', 'Fitness', 'Code', 'Water', 'Nature', 'Creative']),
  weekStart: z.enum(['monday', 'sunday']).default('monday'),
  theme: z.enum(['auto', 'light', 'dark']).default('auto'),
});

export const habitsAppMeta: FieldMetaMap = {
  habits: {
    description: 'Habit names, in ring order (colors assigned by position)',
    placeholder: 'Add habit',
    identityKeyed: true,
  },
  weekStart: { description: 'First day of the monthly ring' },
  theme: { description: 'auto = follow device theme setting' },
};

export type HabitsAppConfig = z.infer<typeof habitsAppSchema>;
