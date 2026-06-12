// Shared types between admin SPA, kiosk SPA, and Express server.
// Wire format for /api/admin/* and /api/device/* lives here.
// See docs/admin/foundation.md for the conceptual model.

export type DeviceId =
  | 'superclock-fast'
  | 'superclock-small'
  | 'superclock-square'
  | 'superclock-slow';

export const ALL_DEVICE_IDS: readonly DeviceId[] = [
  'superclock-fast',
  'superclock-small',
  'superclock-square',
  'superclock-slow',
];

export type DeviceKind = 'kiosk' | 'lvgl';

export type ComplicationShape = 'small' | 'circular' | 'wide';

export type FeatureFlag =
  | 'brightness'
  | 'sleep_schedule'
  | 'theme'
  | 'accent'
  | 'night_mode';

export interface ComplicationSlot {
  id: string;
  shape: ComplicationShape;
}

export interface FaceDescriptor {
  id: string;
  name: string;
  preview: string;
  category?: string;
  configSchemaId?: string;
  slots: ComplicationSlot[];
}

export interface ComplicationDescriptor {
  id: string;
  name: string;
  shapes: ComplicationShape[];
  configSchemaId?: string;
}

export interface AppDescriptor {
  id: string;
  configSchemaId?: string;
  faces?: FaceDescriptor[];
}

export interface DeviceCapabilities {
  id: DeviceId;
  kind: DeviceKind;
  host: string;
  readOnly: boolean;
  apps: AppDescriptor[];
  features: FeatureFlag[];
}

export interface ScreenInstance {
  id: string;
  appId: string;
  config: Record<string, unknown>;
  label?: string;
}

export interface DeviceConfig {
  deviceId: DeviceId;
  enabledApps: string[];
  instances: ScreenInstance[];
  playlist: {
    items: string[];
    rotationSeconds: number | null;
  };
  settings: {
    theme: 'light' | 'dark' | 'system';
    accent: string;
    brightness?: number;
    sleepSchedule?: { wake: string; sleep: string };
    night?: { start: string; end: string; brightness?: number };
  };
  updatedAt: string;
}

export interface FleetConfig {
  devices: DeviceConfig[];
  version: number;
  // Migration stamp bumped by fleet-store schema migrations — NOT the
  // per-write counter above.
  schemaVersion?: number;
}

export interface DeviceState {
  currentScreenId: string | null;
  uptimeMs: number;
  lastConfigAt: string | null;
}

export interface FleetHealth {
  devices: Array<{
    id: DeviceId;
    reachable: boolean;
    lastSeen: string | null;
    pending: boolean;
  }>;
}

// UI metadata for schema-driven forms. Schemas stay pure-zod (data); meta
// describes labels, descriptions, ranges, and conditional visibility (form).
// Lives in shared/ so both admin and any future kiosk-side settings UI can
// import the same descriptors.
export interface FieldMeta {
  label?: string;
  description?: string;
  placeholder?: string;
  format?: 'color' | 'url' | 'time';
  min?: number;
  max?: number;
  step?: number;
  showIf?: (value: Record<string, unknown>) => boolean;
}

export type FieldMetaMap = Record<string, FieldMeta>;

export function emptyDeviceConfig(deviceId: DeviceId): DeviceConfig {
  return {
    deviceId,
    enabledApps: [],
    instances: [],
    playlist: { items: [], rotationSeconds: null },
    settings: { theme: 'system', accent: '#ff6b35' },
    updatedAt: new Date(0).toISOString(),
  };
}
