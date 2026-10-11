import { z } from 'zod';
import type { FieldMetaMap } from '../types';
import {
  AVATAR_ACTIVITIES,
  AVATAR_DESIGN_IDS,
  AVATAR_EXPRESSIONS,
  DEFAULT_DESIGN_ID,
} from '../ai-face-designs';

// design ids grow as families land (SP2): adding enum values is a minor
// change under the snapshot gate; removing one is breaking.
export const aiFaceAppSchema = z.object({
  design: z.enum(AVATAR_DESIGN_IDS).default(DEFAULT_DESIGN_ID),
  source: z.enum(['demo', 'fixed']).default('demo'),
  activity: z.enum(AVATAR_ACTIVITIES).default('idle'),
  expression: z.enum(AVATAR_EXPRESSIONS).default('neutral'),
  showTime: z.boolean().default(false),
  sleepAtNight: z.boolean().default(true),
});

export const aiFaceAppMeta: FieldMetaMap = {
  design: { label: 'Face', description: 'Which AI-Avatars character to show, as family/character' },
  source: { label: 'Driven by', description: 'Demo cycles through every activity; Fixed holds the one below' },
  activity: { showIf: (v) => v.source === 'fixed' },
  expression: { showIf: (v) => v.source === 'fixed' },
  showTime: { label: 'Show time', description: 'A small time label, for when the face is the home screen' },
  sleepAtNight: { label: 'Sleep at night', description: 'Shows the sleeping activity during the night window' },
};

export type AiFaceAppConfig = z.infer<typeof aiFaceAppSchema>;
