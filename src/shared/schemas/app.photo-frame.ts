import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const photoFrameAppSchema = z.object({
  source: z.enum(['local', 'url', 'unsplash']).default('local'),
  sourcePath: z.string().default(''),
  intervalSeconds: z.number().int().min(3).max(300).default(8),
  transition: z.enum(['fade', 'cut', 'zoom']).default('fade'),
});

export const photoFrameAppMeta: FieldMetaMap = {
  source: { description: 'Where photos come from (only "local" is implemented)' },
  sourcePath: {
    description: 'Folder name (local), URL (url), or topic (unsplash)',
    placeholder: 'family-2024',
    showIf: (v) => v.source !== 'local',
  },
  intervalSeconds: { min: 3, max: 300, step: 1, description: 'Seconds between slides' },
  transition: { description: '"zoom" is not implemented yet and falls back to fade' },
};

export type PhotoFrameAppConfig = z.infer<typeof photoFrameAppSchema>;
