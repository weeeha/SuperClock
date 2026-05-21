import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const calendarAppSchema = z.object({
  source: z.string().default('default'),
  lookaheadHours: z.number().int().min(1).max(168).default(24),
  maxEvents: z.number().int().min(1).max(6).default(3),
});

export const calendarAppMeta: FieldMetaMap = {
  source: {
    description: 'ICS URL or "default" to use the server\'s configured calendar',
    placeholder: 'https://calendar.example.com/feed.ics',
  },
  lookaheadHours: { min: 1, max: 168, step: 1, description: 'Hours ahead to include' },
  maxEvents: { min: 1, max: 6, step: 1, description: 'Events visible on the face at once' },
};

export type CalendarAppConfig = z.infer<typeof calendarAppSchema>;
