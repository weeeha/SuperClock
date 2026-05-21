import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const floralFaceSchema = z.object({
  accent: z.string().default('#f59e0b'),
});

export const floralFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Hand color over the artwork' },
};

export type FloralFaceConfig = z.infer<typeof floralFaceSchema>;
