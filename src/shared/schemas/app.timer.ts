import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Minute values offered as presets. Strings because the admin's ordered
// multi-select renders enums; it has no number-list editor.
export const TIMER_PRESET_MINUTES = ['1', '2', '3', '5', '10', '15', '20', '25', '30', '45', '60'] as const;

export const timerAppSchema = z.object({
  presets: z.array(z.enum(TIMER_PRESET_MINUTES)).max(4).default(['1', '3', '5', '10']),
  sound: z.boolean().default(true),
});

export const timerAppMeta: FieldMetaMap = {
  presets: { label: 'Presets', description: 'Up to four, in the order they appear on the clock' },
  sound: {
    label: 'Sound when done',
    description: 'Plays on clocks with a speaker (Fast). Others pulse silently.',
  },
};

export type TimerAppConfig = z.infer<typeof timerAppSchema>;
