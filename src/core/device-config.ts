import { useSyncExternalStore } from 'react';
import type { DeviceConfig, ScreenInstance } from '../shared/types';
import { loadLocalConfig, subscribeToConfig } from '../shared/local-config';
import { useNavigation } from './navigation';

const getServerSnapshot = (): DeviceConfig | null => null;

export function useDeviceConfig(): DeviceConfig | null {
  return useSyncExternalStore(subscribeToConfig, loadLocalConfig, getServerSnapshot);
}

// Returns the screen instance the user should currently see:
//   1. If playlist set activeInstanceId, use that.
//   2. Else fall back to the first instance whose appId matches activeAppId
//      (Step 3 behavior — preserves manual-swipe navigation when no playlist
//      position is locked).
export function useActiveInstance(appId: string): ScreenInstance | undefined {
  const config = useDeviceConfig();
  const activeInstanceId = useNavigation((s) => s.activeInstanceId);

  if (!config) return undefined;
  if (activeInstanceId) {
    const exact = config.instances.find((i) => i.id === activeInstanceId);
    if (exact && exact.appId === appId) return exact;
  }
  return config.instances.find((i) => i.appId === appId);
}
