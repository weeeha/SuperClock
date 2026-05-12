import { useEffect, useRef } from 'react';
import { useDeviceConfig } from './device-config';
import { useNavigation } from './navigation';

// 30-second cooldown after any user gesture before auto-rotation resumes.
const GESTURE_PAUSE_MS = 30_000;

// Drives auto-rotation through DeviceConfig.playlist.items.
// On enable, immediately shows items[0]. Each tick advances to the next item.
// Pauses for GESTURE_PAUSE_MS after any swipe/grid interaction.
// No-op when rotationSeconds is null or playlist is empty.
export function usePlaylistAutoRotate(): void {
  const config = useDeviceConfig();
  const switchToInstance = useNavigation((s) => s.switchToInstance);
  const positionRef = useRef(0);

  const items = config?.playlist.items ?? [];
  const rotationSeconds = config?.playlist.rotationSeconds ?? null;
  const instances = config?.instances ?? [];
  const itemsKey = items.join('|');

  useEffect(() => {
    if (!rotationSeconds || items.length === 0) return;

    const goto = (index: number) => {
      positionRef.current = index;
      const instance = instances.find((i) => i.id === items[index]);
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
