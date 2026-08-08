import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const todoAppSchema = z.object({
  showCompleted: z.boolean().default(true),
  // Caps the DONE archive only — active tasks are never auto-pruned.
  maxItems: z.number().int().min(10).max(1000).default(200),
});

export const todoAppMeta: FieldMetaMap = {
  showCompleted: { description: 'Show the Done view (swipe up from Active)' },
  maxItems: {
    description: 'Completed items kept — oldest pruned past this; active items are never pruned',
  },
};

export type TodoAppConfig = z.infer<typeof todoAppSchema>;
