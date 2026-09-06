import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const claudeUsageAppSchema = z.object({
  scope: z.enum(['all', 'this-machine', 'directory']).default('all'),
  // Default = the 30s poll the app has always run, so an unconfigured instance
  // behaves exactly as before the schema was wired.
  refreshSeconds: z.number().int().min(30).max(600).default(30),
  moodEnabled: z.boolean().default(true),
});

export const claudeUsageAppMeta: FieldMetaMap = {
  scope: {
    description: 'What the rate-limit usage rolls up',
    unimplemented:
      'the usage daemon (mac-daemon/claude-usage) reports one rollup; per-scope numbers need daemon support first',
  },
  refreshSeconds: { min: 30, max: 600, step: 30, description: 'Polling interval' },
  moodEnabled: { description: 'Show the Clawd sprite reacting to load' },
};

export type ClaudeUsageAppConfig = z.infer<typeof claudeUsageAppSchema>;
