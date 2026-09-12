import { z } from 'zod';
import type { FieldMetaMap } from '../types';
import { handShadowField, handShadowFieldMeta } from './hand-shadow';

export const worldFaceSchema = z.object({
  // Default = the red second hand and hub ring the primary dial has always
  // drawn, so an unconfigured instance looks exactly as before.
  accent: z.string().default('#ee0000'),
  primaryTimezone: z.string().default('local'),
  handShadow: handShadowField,
});

export const worldFaceMeta: FieldMetaMap = {
  accent: { format: 'color', description: 'Highlight color for the primary dial' },
  primaryTimezone: {
    description: 'IANA timezone (e.g. America/Los_Angeles) or "local" for the device clock',
    placeholder: 'local',
  },
  handShadow: handShadowFieldMeta,
};

export type WorldFaceConfig = z.infer<typeof worldFaceSchema>;
