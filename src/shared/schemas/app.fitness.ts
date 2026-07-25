import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Replaces the old rep-counter fields (exercise/dailyGoal/resetAt), which
// have no meaning now the app is workout-only. Stale keys in fleet.json are
// harmless: instance config is typed as an opaque record at the
// device-config layer, and this plain z.object strips unknown keys.
export const fitnessAppSchema = z.object({
  workoutId: z.enum(['full-body', 'core', 'lower']).default('full-body'),
  workSeconds: z.number().int().min(10).max(120).default(30),
  restSeconds: z.number().int().min(0).max(60).default(10),
  rounds: z.number().int().min(1).max(5).default(1),
  voiceCues: z.boolean().default(true),
  beeps: z.boolean().default(true),
  keepBright: z.boolean().default(true),
});

export const fitnessAppMeta: FieldMetaMap = {
  workoutId: { description: 'Which circuit runs when you tap to start' },
  workSeconds: { min: 10, max: 120, step: 5, description: 'Seconds per exercise' },
  restSeconds: { min: 0, max: 60, step: 5, description: 'Seconds between exercises (0 = no rest)' },
  rounds: { min: 1, max: 5, step: 1, description: 'Times to repeat the circuit' },
  voiceCues: { description: 'Announce each exercise by name' },
  beeps: { description: 'Countdown and transition tones' },
  keepBright: { description: 'Ignore night dimming while a workout is running' },
};

export type FitnessAppConfig = z.infer<typeof fitnessAppSchema>;
