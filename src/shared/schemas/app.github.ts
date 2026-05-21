import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const githubAppSchema = z.object({
  username: z.string().default(''),
  colorScheme: z.enum(['default', 'monochrome', 'accent']).default('default'),
  refreshMinutes: z.number().int().min(5).max(120).default(30),
});

export const githubAppMeta: FieldMetaMap = {
  username: {
    description: 'Leave blank to use the token owner ("viewer")',
    placeholder: 'weeeha',
  },
  colorScheme: { description: 'How the 5-step heatmap is colored' },
  refreshMinutes: { min: 5, max: 120, step: 5, description: 'Polling interval' },
};

export type GithubAppConfig = z.infer<typeof githubAppSchema>;
