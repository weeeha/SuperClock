import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const claudeUsageAppSchema = z.object({
  scope: z.enum(['all', 'this-machine', 'directory']).default('all'),
  refreshSeconds: z.number().int().min(30).max(600).default(60),
  moodEnabled: z.boolean().default(true),
});

export const claudeUsageAppMeta: FieldMetaMap = {
  scope: { description: 'What the rate-limit usage rolls up' },
  refreshSeconds: { min: 30, max: 600, step: 30, description: 'Polling interval' },
  moodEnabled: { description: 'Show the Clawd sprite reacting to load' },
};

export type ClaudeUsageAppConfig = z.infer<typeof claudeUsageAppSchema>;
