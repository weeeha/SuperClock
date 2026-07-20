import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { defaultsFor } from '../../shared/schema-registry';
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

  // Face options saved by the admin (FaceConfig.tsx) live at config.face.
  // Merge over schema defaults so new fields appear with sane values.
  const savedFace =
    props.config?.face && typeof props.config.face === 'object'
      ? (props.config.face as Record<string, unknown>)
      : undefined;
  const faceConfig = configFaceId
    ? { ...defaultsFor(`face.${configFaceId}`), ...savedFace }
    : undefined;

  return (
    <div className="relative h-full w-full">
      <Face isActive={props.isActive} faceConfig={faceConfig} />
    </div>
  );
}
