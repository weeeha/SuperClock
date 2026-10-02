import { Suspense, createElement, useEffect } from 'react';
import { RING_MS, useAlerts, ringPhase } from './alert-store';
import { getAlertView, getLeadView, type AlertViewProps } from './views';
import { createChime, deviceHasAudio } from './chime';
import { requestPanelWake } from './wake';
import { acquireBrightnessLease, releaseBrightnessLease } from '../brightness-lease';
import { useDeviceConfig } from '../device-config';

/** The brightness lease lasts 90 s; renew well inside it. */
const LEASE_RENEW_MS = 60_000;
/** Keep the panel on a minute past the settle time. */
const WAKE_GRACE_MS = 60_000;

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
  const hideLead = useAlerts((s) => s.hideLead);
  const leadAlert = useAlerts((s) => (s.leading ? s.scheduled.find((a) => a.id === s.leading) ?? null : null));
  const leadHidden = useAlerts((s) => s.leadHidden);
  const deviceId = useDeviceConfig()?.deviceId;

  const ringingNow = ringing !== null && !ringing.settled;
  const shouldChime = ringingNow && ringing.sound && deviceHasAudio(deviceId);
  const holdBright = ringingNow && ringing.bright === true;
  const ringWakeUntil = ringingNow ? ringing.firedAt + (ringing.ringMs ?? RING_MS) + WAKE_GRACE_MS : null;
  const leadWakeUntil = leadAlert ? leadAlert.firesAt + (leadAlert.ringMs ?? RING_MS) + WAKE_GRACE_MS : null;

  useEffect(() => {
    if (!shouldChime) return;
    const chime = createChime();
    chime.start();
    return () => chime.stop();
  }, [shouldChime]);

  // Full brightness while a bright alert rings, over night dimming.
  useEffect(() => {
    if (!holdBright) return;
    acquireBrightnessLease();
    const id = setInterval(() => acquireBrightnessLease(), LEASE_RENEW_MS);
    return () => {
      clearInterval(id);
      releaseBrightnessLease();
    };
  }, [holdBright]);

  // Wake a panel the server switched off: once per ring, once per lead.
  useEffect(() => {
    if (ringWakeUntil !== null) requestPanelWake(ringWakeUntil);
  }, [ringWakeUntil]);
  useEffect(() => {
    if (leadWakeUntil !== null) requestPanelWake(leadWakeUntil);
  }, [leadWakeUntil]);

  if (ringing) {
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

  const Lead = leadAlert && !leadHidden ? getLeadView(leadAlert.appId) : undefined;
  if (leadAlert && Lead) {
    return (
      <div role="dialog" aria-label="Alarm coming up" className="fixed inset-0 z-[9500]">
        <Suspense fallback={null}>{createElement(Lead, { alert: leadAlert, hide: hideLead })}</Suspense>
      </div>
    );
  }
  return null;
}
