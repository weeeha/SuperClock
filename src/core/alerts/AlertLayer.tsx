import { Suspense, createElement, useEffect } from 'react';
import { useAlerts, ringPhase } from './alert-store';
import { getAlertView, type AlertViewProps } from './views';
import { createChime, deviceHasAudio } from './chime';
import { useDeviceConfig } from '../device-config';

// An alert whose app registered no view still has to be clearable.
function FallbackAlert({ dismiss }: AlertViewProps) {
  return (
    <button
      type="button"
      onClick={dismiss}
      className="theme-fade flex h-full w-full flex-col items-center justify-center gap-[1.5vmin] bg-(--face-bg) text-center"
    >
      <span className="text-[2.6vmin] font-medium text-(--face-ink)">Alert</span>
      <span className="text-[2.2vmin] text-(--face-ink-muted)">Tap to dismiss</span>
    </button>
  );
}

/** Mounted last in App: above every app, the grid, quick settings and the
 *  presence shade (z-9000); below only the dev gesture-debug badge (z-9999). */
export default function AlertLayer() {
  const ringing = useAlerts((s) => s.ringing);
  const dismiss = useAlerts((s) => s.dismiss);
  const deviceId = useDeviceConfig()?.deviceId;
  const shouldChime = Boolean(ringing && !ringing.settled && ringing.sound && deviceHasAudio(deviceId));

  useEffect(() => {
    if (!shouldChime) return;
    const chime = createChime();
    chime.start();
    return () => chime.stop();
  }, [shouldChime]);

  if (!ringing) return null;
  // createElement, not <View/>: the registry hands back a module-level
  // component with a stable identity per appId, which react-hooks'
  // static-components rule cannot see through a call result.
  const view = createElement(getAlertView(ringing.appId) ?? FallbackAlert, {
    alert: ringing,
    phase: ringPhase(ringing),
    dismiss,
  });
  return (
    <div role="alertdialog" aria-label="Alert" className="fixed inset-0 z-[9500]">
      <Suspense fallback={null}>{view}</Suspense>
    </div>
  );
}
