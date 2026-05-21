import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const timeTrackingAppSchema = z.object({
  defaultProject: z.string().default(''),
  dailyTargetHours: z.number().min(0).max(24).default(8),
  weekStart: z.enum(['monday', 'sunday']).default('monday'),
});

export const timeTrackingAppMeta: FieldMetaMap = {
  defaultProject: {
    description: 'Project the START button kicks off when nothing is selected',
    placeholder: 'Deep Work',
  },
  dailyTargetHours: { min: 0, max: 24, step: 0.5, description: 'Fills the daily ring' },
  weekStart: { description: 'First day of the weekly summary' },
};

export type TimeTrackingAppConfig = z.infer<typeof timeTrackingAppSchema>;
