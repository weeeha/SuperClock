import type {
  AppDescriptor,
  DeviceCapabilities,
  DeviceId,
  DeviceKind,
  FeatureFlag,
} from './types';
import { FACES } from './face-registry';

interface StaticDeviceInfo {
  id: DeviceId;
  kind: DeviceKind;
  host: string;
  readOnly: boolean;
  features: FeatureFlag[];
  supportedAppIds: string[];
}

// Must match the registrations in src/apps/index.ts — pinned by
// src/shared/registry-coherence.test.ts so drift fails CI instead of
// shipping an app the admin can't see.
const ALL_KIOSK_APP_IDS = [
  'clock',
  'weather',
  'calendar',
  'fitness',
  'github',
  'habits',
  'fireplace',
  'photo-frame',
  'quote',
  'time-tracking',
  'claude-usage',
];

// AppDescriptors built from the registries — no React imports, safe for
// server-side. Every app's config schema is `app.<id>` in schema-registry.ts;
// clock is the exception (its config is face-driven via FACES).
const APP_DESCRIPTORS: Record<string, AppDescriptor> = Object.fromEntries(
  ALL_KIOSK_APP_IDS.map((id) => [
    id,
    id === 'clock' ? { id, faces: FACES } : { id, configSchemaId: `app.${id}` },
  ]),
);

export const STATIC_DEVICE_INFO: Record<DeviceId, StaticDeviceInfo> = {
  'superclock-fast': {
    id: 'superclock-fast',
    kind: 'kiosk',
    host: 'superclock-fast.local',
    readOnly: false,
    features: ['brightness', 'sleep_schedule', 'theme', 'accent', 'night_mode'],
    supportedAppIds: ALL_KIOSK_APP_IDS,
  },
  'superclock-small': {
    id: 'superclock-small',
    kind: 'kiosk',
    host: 'superclock-small.local',
    readOnly: false,
    features: ['brightness', 'sleep_schedule', 'theme', 'accent', 'night_mode'],
    supportedAppIds: ALL_KIOSK_APP_IDS,
  },
  'superclock-square': {
    id: 'superclock-square',
    kind: 'kiosk',
    host: 'superclock-square.local',
    readOnly: false,
    features: ['brightness', 'sleep_schedule', 'theme', 'accent', 'night_mode'],
    supportedAppIds: ALL_KIOSK_APP_IDS,
  },
  'superclock-slow': {
    id: 'superclock-slow',
    kind: 'lvgl',
    host: 'superclock-slow.local',
    readOnly: true,
    features: ['theme'],
    supportedAppIds: ['clock'],
  },
};

export function buildCapabilities(deviceId: DeviceId): DeviceCapabilities {
  const info = STATIC_DEVICE_INFO[deviceId];
  const apps = info.supportedAppIds
    .map((id) => APP_DESCRIPTORS[id])
    .filter((a): a is AppDescriptor => a !== undefined);
  return {
    id: info.id,
    kind: info.kind,
    host: info.host,
    readOnly: info.readOnly,
    features: info.features,
    apps,
  };
}
