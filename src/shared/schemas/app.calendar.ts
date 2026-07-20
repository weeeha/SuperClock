import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const calendarAppSchema = z.object({
  source: z.string().default('default'),
  weekStart: z.enum(['monday', 'sunday']).default('monday'),
  defaultView: z.enum(['month', 'week']).default('month'),
  timeFormat: z.enum(['24h', '12h']).default('24h'),
});

export const calendarAppMeta: FieldMetaMap = {
  source: {
    description: 'ICS URL or "default" to use the server\'s configured calendar',
    placeholder: 'https://calendar.example.com/feed.ics',
  },
  weekStart: { description: 'First day of the week' },
  defaultView: { description: 'View shown when the app opens' },
  timeFormat: { description: 'Clock format for event times' },
};

export type CalendarAppConfig = z.infer<typeof calendarAppSchema>;
