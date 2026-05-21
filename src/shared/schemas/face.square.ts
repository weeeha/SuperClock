import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const squareFaceSchema = z.object({
  accent: z.string().default('#22c55e'),
});

export const squareFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Sub-dial accent color' },
};

export type SquareFaceConfig = z.infer<typeof squareFaceSchema>;
