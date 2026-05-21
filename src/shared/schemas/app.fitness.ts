import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const fitnessAppSchema = z.object({
  exercise: z.string().default('Push-ups'),
  dailyGoal: z.number().int().min(1).max(500).default(50),
  resetAt: z.enum(['midnight', 'wake-time', 'manual']).default('midnight'),
});

export const fitnessAppMeta: FieldMetaMap = {
  exercise: { description: 'Label shown inside the ring', placeholder: 'Push-ups' },
  dailyGoal: { min: 1, max: 500, step: 1, description: 'Reps to fill the ring' },
  resetAt: { description: 'When the counter zeroes back to 0' },
};

export type FitnessAppConfig = z.infer<typeof fitnessAppSchema>;
