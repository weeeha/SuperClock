import type {
  AppDescriptor,
  DeviceCapabilities,
  DeviceId,
  DeviceKind,
  FeatureFlag,
} from './types';
import { ALL_DEVICE_IDS } from './types';
import { FACES } from './face-registry';
import { APP_CAPABILITIES } from './app-capabilities';

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
  'agents',
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
  'breathing',
  'todo',
];

// AppDescriptors built from the registries — no React imports, safe for
// server-side. Every app's config schema is `app.<id>` in schema-registry.ts;
// clock is the exception (its config is face-driven via FACES). Capabilities
// come from app-capabilities.ts, pinned to the code by its contract test.
const APP_DESCRIPTORS: Record<string, AppDescriptor> = Object.fromEntries(
  ALL_KIOSK_APP_IDS.map((id) => [
    id,
    id === 'clock'
      ? { id, faces: FACES, capabilities: APP_CAPABILITIES[id] }
      : { id, configSchemaId: `app.${id}`, capabilities: APP_CAPABILITIES[id] },
  ]),
);

// Software features are identical across the Chromium devices; the hardware
// flags (audio, mic, radar) follow fleet.md and device.json: fast carries the
// Fusion HAT mic + speaker and hosts the A121 radar, small and square have USB
// mics, slow has neither. Gating UI on these is a follow-up; declaring them is
// what makes that UI possible (2026-08-15 state audit).
const SOFTWARE_FEATURES: FeatureFlag[] = ['brightness', 'sleep_schedule', 'theme', 'accent', 'night_mode'];

export const STATIC_DEVICE_INFO: Record<DeviceId, StaticDeviceInfo> = {
  'superclock-fast': {
    id: 'superclock-fast',
    kind: 'kiosk',
    host: 'superclock-fast.local',
    readOnly: false,
    features: [...SOFTWARE_FEATURES, 'audio', 'mic', 'radar'],
    supportedAppIds: ALL_KIOSK_APP_IDS,
  },
  'superclock-small': {
    id: 'superclock-small',
    kind: 'kiosk',
    host: 'superclock-small.local',
    readOnly: false,
    features: [...SOFTWARE_FEATURES, 'mic'],
    supportedAppIds: ALL_KIOSK_APP_IDS,
  },
  'superclock-square': {
    id: 'superclock-square',
    kind: 'kiosk',
    host: 'superclock-square.local',
    readOnly: false,
    features: [...SOFTWARE_FEATURES, 'mic'],
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

/** Fleet devices whose declared features include `flag`. */
export function devicesProviding(flag: FeatureFlag): DeviceId[] {
  return ALL_DEVICE_IDS.filter((id) => STATIC_DEVICE_INFO[id].features.includes(flag));
}

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
