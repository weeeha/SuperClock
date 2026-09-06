import type { DeviceCapabilities } from '../../shared/types';
import { FACES } from '../../shared/face-registry';
import { APP_ICONS } from '../../shared/app-icons';
import { defaultsFor } from '../../shared/schema-registry';
import { appDisplayName } from './app-names';

// Pure logic behind the Add Screen sheet (wf/3): one flattened list per
// foundation decision #7 — a clock face is a playlist-eligible screen, equal
// in standing with any app screen — so faces and apps share one picker,
// grouped "Clock faces" first, then apps.

export type AddableScreen =
  | { kind: 'face'; faceId: string; name: string; preview: string }
  | { kind: 'app'; appId: string; name: string; icon: string | null };

/** Every registry face first (with its preview art), then the device's apps
 *  minus `clock` — faces already represent it. */
export function listAddableScreens(caps: DeviceCapabilities): AddableScreen[] {
  const faces: AddableScreen[] = FACES.map((f) => ({
    kind: 'face',
    faceId: f.id,
    name: f.name,
    preview: f.preview,
  }));
  const apps: AddableScreen[] = caps.apps
    .filter((a) => a.id !== 'clock')
    .map((a) => ({
      kind: 'app',
      appId: a.id,
      name: appDisplayName(a.id),
      icon: APP_ICONS[a.id] ?? null,
    }));
  return [...faces, ...apps];
}

/** Instance body for POST /instances — schema defaults resolved locally
 *  (capabilities transmit schema IDs only; `defaultsFor` of a face with no
 *  schema, e.g. minimalismo, is honestly `{}`). */
export function buildNewInstance(entry: AddableScreen): {
  appId: string;
  label?: string;
  config: Record<string, unknown>;
} {
  if (entry.kind === 'face') {
    return {
      appId: 'clock',
      label: entry.name,
      config: { faceId: entry.faceId, face: defaultsFor(`face.${entry.faceId}`) },
    };
  }
  return { appId: entry.appId, config: defaultsFor(`app.${entry.appId}`) };
}
