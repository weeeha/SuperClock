import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const todoAppSchema = z.object({
  showCompleted: z.boolean().default(true),
  maxItems: z.number().int().min(1).max(200).default(50),
});

export const todoAppMeta: FieldMetaMap = {
  showCompleted: { description: 'Enable the Done view (swipe up from the active list)' },
  maxItems: { description: 'Most items shown per view' },
};

export type TodoAppConfig = z.infer<typeof todoAppSchema>;
