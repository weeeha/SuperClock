import { useEffect, useRef } from 'react';
import { useDeviceConfig } from './device-config';
import { useNavigation } from './navigation';
import { loadLocalConfig } from '../shared/local-config';
import type { DeviceConfig } from '../shared/types';

// 30-second cooldown after any user gesture before auto-rotation resumes.
const GESTURE_PAUSE_MS = 30_000;

// Single source of truth for "is there a playlist to rotate through" —
// shared by the hook (via useDeviceConfig) and isPlaylistDriving (via the
// same localStorage-backed snapshot, read outside React).
function getRotationState(config: DeviceConfig | null) {
  const items = config?.playlist.items ?? [];
  const rotationSeconds = config?.playlist.rotationSeconds ?? null;
  return { items, rotationSeconds };
}

// True when the device has an active, non-empty playlist — i.e.
// usePlaylistAutoRotate is (or will imminently be) driving navigation.
// Non-hook so it can be called from plain functions like useIdleReturn's
// checkIdle(); reads the same cached config snapshot loadLocalConfig()
// backs useDeviceConfig with, so this never drifts from what the hook sees.
export function isPlaylistDriving(): boolean {
  const { items, rotationSeconds } = getRotationState(loadLocalConfig());
  return Boolean(rotationSeconds) && items.length > 0;
}

// Drives auto-rotation through DeviceConfig.playlist.items.
// On enable, immediately shows items[0]. Each tick advances to the next item.
// Pauses for GESTURE_PAUSE_MS after any swipe/grid interaction.
// No-op when rotationSeconds is null or playlist is empty.
export function usePlaylistAutoRotate(): void {
  const config = useDeviceConfig();
  const switchToInstance = useNavigation((s) => s.switchToInstance);
  const positionRef = useRef(0);

  const { items, rotationSeconds } = getRotationState(config);
  const instances = config?.instances ?? [];
  const itemsKey = items.join('|');

  // Read instances through a ref so goto() never resolves against a stale
  // array (instance edits don't change itemsKey, so the effect doesn't rerun).
  const instancesRef = useRef(instances);
  instancesRef.current = instances;

  useEffect(() => {
    if (!rotationSeconds || items.length === 0) return;

    const goto = (index: number) => {
      positionRef.current = index;
      const instance = instancesRef.current.find((i) => i.id === items[index]);
      if (instance) switchToInstance(instance.id, instance.appId);
    };

    // Sync to wherever we are if the current instance is in the playlist;
    // otherwise jump to items[0] so the user sees the playlist start.
    const currentId = useNavigation.getState().activeInstanceId;
    const currentIdx = currentId ? items.indexOf(currentId) : -1;
    if (currentIdx >= 0) {
      positionRef.current = currentIdx;
    } else {
      goto(0);
    }

    const tick = () => {
      const since = Date.now() - useNavigation.getState().lastGestureMs;
      if (since < GESTURE_PAUSE_MS) return;
      goto((positionRef.current + 1) % items.length);
    };

    const timer = window.setInterval(tick, rotationSeconds * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotationSeconds, itemsKey, switchToInstance]);
}
