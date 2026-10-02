import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Device-wide alarm defaults. The alarms themselves are content in the Alarm
// app's store (set on the glass); the admin's alarm list arrives with the
// content sync in sub-project 4.
export const alarmAppSchema = z.object({
  snoozeMinutes: z.number().int().min(1).max(30).default(9),
  sound: z.boolean().default(true),
  gentleWakeMinutes: z.number().int().min(0).max(30).default(10),
});

export const alarmAppMeta: FieldMetaMap = {
  snoozeMinutes: { label: 'Snooze minutes', min: 1, max: 30, step: 1 },
  sound: { label: 'Sound', description: 'Plays on clocks with a speaker (Fast). Others flash at full brightness.' },
  gentleWakeMinutes: {
    label: 'Gentle wake minutes',
    description: 'Minutes of brightening before the alarm. 0 turns it off.',
    min: 0,
    max: 30,
    step: 1,
  },
};

export type AlarmAppConfig = z.infer<typeof alarmAppSchema>;
