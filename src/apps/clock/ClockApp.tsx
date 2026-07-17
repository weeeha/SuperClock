import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { FACE_COMPONENTS, SWIPE_CYCLE_ORDER } from './face-components';

export default function ClockApp(props: AppProps) {
  const [faceIndex, setFaceIndex] = useState(0);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);

  const configFaceId = typeof props.config?.faceId === 'string' ? props.config.faceId : undefined;
  const configFace = configFaceId ? FACE_COMPONENTS[configFaceId] : undefined;

  useEffect(() => {
    // When a config-driven face is active, the user shouldn't be able to swipe-cycle.
    if (!props.isActive || configFace) {
      setVerticalSwipeCallback(null);
      return;
    }
    setVerticalSwipeCallback((dir) => {
      if (dir === 'down') setFaceIndex((i) => (i + 1) % SWIPE_CYCLE_ORDER.length);
      else setFaceIndex((i) => (i - 1 + SWIPE_CYCLE_ORDER.length) % SWIPE_CYCLE_ORDER.length);
    });
    return () => setVerticalSwipeCallback(null);
  }, [props.isActive, configFace, setVerticalSwipeCallback]);

  const Face = configFace ?? SWIPE_CYCLE_ORDER[faceIndex];

  return (
    <div className="relative h-full w-full">
      <Face isActive={props.isActive} />
    </div>
  );
}
