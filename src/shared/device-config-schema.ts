// Wire-format validation for DeviceConfig writes.
//
// Both write surfaces — admin `PATCH /api/admin/fleet/:deviceId` and device
// `POST /api/device/config` — accept partial configs that get shallow-merged
// over the stored config, then persisted and pushed/polled to kiosks. A
// mis-shaped body (playlist: null, settings: "x", junk keys) would otherwise
// be persisted verbatim and crash the kiosk client on every poll until the
// file is hand-repaired, so both routes MUST validate through this schema.
// Kept beside types.ts so the zod shape and the TS interface evolve together.

import { z } from 'zod';
import { ALL_DEVICE_IDS, type DeviceConfig } from './types';

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM (24h)');

export const screenInstanceSchema = z
  .object({
    id: z.string().min(1),
    appId: z.string().min(1),
    config: z.record(z.string(), z.unknown()),
    label: z.string().optional(),
  })
  .strict();

export const deviceSettingsSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']),
    accent: z.string(),
    brightness: z.number().int().min(0).max(100).optional(),
    sleepSchedule: z.object({ wake: hhmm, sleep: hhmm }).strict().optional(),
    night: z
      .object({
        start: hhmm,
        end: hhmm,
        brightness: z.number().int().min(0).max(100).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const deviceConfigSchema = z
  .object({
    deviceId: z.enum(ALL_DEVICE_IDS),
    enabledApps: z.array(z.string()),
    instances: z.array(screenInstanceSchema),
    playlist: z
      .object({
        items: z.array(z.string()),
        rotationSeconds: z.number().int().positive().nullable(),
      })
      .strict(),
    settings: deviceSettingsSchema,
    updatedAt: z.string(),
  })
  .strict();

// Patch bodies: any subset of top-level keys, each fully valid when present.
// (Merges are shallow — a partial `settings` object REPLACES the stored one —
// so nested keys are required whenever their section is sent.)
export const deviceConfigPatchSchema = deviceConfigSchema.partial();

export type DeviceConfigPatch = z.infer<typeof deviceConfigPatchSchema>;

// Compile-time guard: the zod output must stay assignable to the TS interface.
type _SchemaMatchesType = z.infer<typeof deviceConfigSchema> extends DeviceConfig
  ? true
  : never;
const _schemaMatchesType: _SchemaMatchesType = true;
void _schemaMatchesType;
