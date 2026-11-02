import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { defaultsFor } from '../../shared/schema-registry';
import { SWIPE_CYCLE_ORDER } from './face-components';
import { faceIdAt, startIndexFor } from './face-cycle';

export default function ClockApp(props: AppProps) {
  const configFaceId = typeof props.config?.faceId === 'string' ? props.config.faceId : undefined;
  // Keyed on the configured face: a new face from the admin remounts the
  // cycle at that face instead of carrying over whatever was swiped to.
  return <FaceCycle key={configFaceId ?? ''} {...props} configFaceId={configFaceId} />;
}

function FaceCycle(props: AppProps & { configFaceId: string | undefined }) {
  const { configFaceId } = props;
  // The configured face is where the cycle starts, not a lock: a pinned
  // instance (fastclock's Rally playlist, 2026-11-01) still swipes through
  // every face, and a remount lands back on the configured one.
  const [faceIndex, setFaceIndex] = useState(() => startIndexFor(configFaceId));
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);

  useEffect(() => {
    if (!props.isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    const cb = (dir: 'up' | 'down') => {
      if (dir === 'down') setFaceIndex((i) => (i + 1) % SWIPE_CYCLE_ORDER.length);
      else setFaceIndex((i) => (i - 1 + SWIPE_CYCLE_ORDER.length) % SWIPE_CYCLE_ORDER.length);
    };
    setVerticalSwipeCallback(cb);
    return () => {
      // popLayout keeps the exiting app mounted after the next app registers —
      // only clear the slot if it's still ours.
      if (useNavigation.getState().verticalSwipeCallback === cb) setVerticalSwipeCallback(null);
    };
  }, [props.isActive, setVerticalSwipeCallback]);

  const Face = SWIPE_CYCLE_ORDER[faceIndex];
  const faceId = faceIdAt(faceIndex);

  // Face options saved by the admin (FaceConfig.tsx) live at config.face and
  // belong to the configured face only; a face swiped to runs on its own
  // schema defaults, as it always did. Merge over the defaults so new fields
  // appear with sane values.
  const savedFace =
    props.config?.face && typeof props.config.face === 'object'
      ? (props.config.face as Record<string, unknown>)
      : undefined;
  const faceConfig =
    configFaceId && faceId === configFaceId
      ? { ...defaultsFor(`face.${configFaceId}`), ...savedFace }
      : undefined;

  return (
    <div className="relative h-full w-full" data-face={faceId}>
      <Face isActive={props.isActive} faceConfig={faceConfig} />
    </div>
  );
}
