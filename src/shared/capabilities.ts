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
];

// AppDescriptors built from the registries — no React imports, safe for server-side.
const APP_DESCRIPTORS: Record<string, AppDescriptor> = {
  clock: { id: 'clock', faces: FACES },
  weather: { id: 'weather' },
  calendar: { id: 'calendar' },
  fitness: { id: 'fitness' },
  github: { id: 'github' },
  habits: { id: 'habits' },
  fireplace: { id: 'fireplace' },
  'photo-frame': { id: 'photo-frame' },
  quote: { id: 'quote' },
  'time-tracking': { id: 'time-tracking' },
};

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
