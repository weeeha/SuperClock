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
  | 'night_mode'
  // Hardware a device actually has (fleet.md, device.json). Apps declare what
  // they need in src/shared/app-capabilities.ts; app-capabilities.test.ts
  // holds the two together so a "no mic on this device" tell has a flag to read.
  | 'audio'
  | 'mic'
  | 'radar';

/** What a kiosk app does (fetches, ticks, multiView) and needs (audio, mic,
 *  radar). Declared per app in src/shared/app-capabilities.ts and CHECKED
 *  against the code by app-capabilities.test.ts, never trusted. The hardware
 *  members are FeatureFlags a device must provide. */
export type AppCapability = 'fetches' | 'ticks' | 'multiView' | 'audio' | 'mic' | 'radar';

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
  /** From src/shared/app-capabilities.ts; optional on the wire so an LVGL
   *  device's hand-written capability JSON stays valid without it. */
  capabilities?: readonly AppCapability[];
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
    // 0-100 daytime brightness. Kiosk-side CSS dimming of the rendered image
    // (these panels expose no backlight control); undefined or 100 → full.
    // night.brightness overrides it inside the night window.
    brightness?: number;
    sleepSchedule?: { wake: string; sleep: string };
    night?: { start: string; end: string; brightness?: number };
    // Radar presence wake/sleep (A121 module). Only meaningful on the device
    // the sensor is attached to; ignored when /api/radar reports unavailable.
    presence?: { enabled?: boolean; absentAfterMin?: number };
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

// How an admin write's push to the target device actually ended: delivered,
// persisted-but-undelivered (retry drain will re-push), or skipped by the
// dev-safety guard. Every admin write response reports one honestly.
export type PushOutcome = 'applied' | 'queued' | 'dev-suppressed';

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
  /** For array-of-string fields whose entry text doubles as the entry's
   *  storage identity (habit ids are the trimmed lowercased name; streak
   *  history is keyed by them). The list editor warns when an entry that
   *  existed before the editing session is renamed. Case/whitespace-only
   *  changes don't re-key, so they don't warn. */
  identityKeyed?: boolean;
  /** The option is declared and saved but nothing on the glass honours it yet
   *  (a backend that cannot serve it, a renderer not built). The admin renders
   *  the control disabled with this note: never hidden, never silently broken. */
  unimplemented?: string;
}

export type FieldMetaMap = Record<string, FieldMeta>;

/** Single home for the default accent — admin forms seed from this too.
 *  (The kiosk CSS fallback --color-accent in src/index.css is a separate,
 *  pre-config value; apply-settings overwrites it once config arrives.) */
export const DEFAULT_ACCENT = '#ff6b35';

export function emptyDeviceConfig(deviceId: DeviceId): DeviceConfig {
  return {
    deviceId,
    enabledApps: [],
    instances: [],
    playlist: { items: [], rotationSeconds: null },
    settings: { theme: 'system', accent: DEFAULT_ACCENT },
    updatedAt: new Date(0).toISOString(),
  };
}
