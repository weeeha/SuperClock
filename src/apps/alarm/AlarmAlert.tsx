import { useRef, useState } from 'react';
import type { AlertViewProps } from '../../core/alerts/views';
import { useAlerts } from '../../core/alerts/alert-store';
import { deviceHasAudio } from '../../core/alerts/chime';
import { useDeviceConfig } from '../../core/device-config';
import { alarmSettings, nextScheduledAlarm, snoozeAlarm } from './alarm-sync';
import { nextLabel } from './alarm-schedule';

const HOLD_MS = 2000;
const TAP_MS = 500;

/** Board frames 5, 6 and 8. With a speaker: the time inside two still accent
 *  rings (the chime is the alarm). Without: the full-screen flash and a chip.
 *  Tap to snooze; hold 2 s to stop. After 15 minutes: Missed. */
export default function AlarmAlert({ alert, phase, dismiss }: AlertViewProps) {
  const config = useDeviceConfig();
  const settings = alarmSettings(config);
  const speaker = deviceHasAudio(config?.deviceId);
  const nextAt = useAlerts((s) => nextScheduledAlarm(s.scheduled));
  const [renderNow] = useState(() => Date.now());
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downAt = useRef(0);
  const time = String(alert.payload.time ?? '');

  if (phase === 'settled') {
    return (
      <button
        type="button"
        aria-label="Clear missed alarm"
        onClick={dismiss}
        className="theme-fade flex h-full w-full flex-col items-center justify-center bg-(--face-bg) text-center"
      >
        <span className="text-[2.6vmin] font-medium text-(--face-ink)">Missed</span>
        <span className="mt-[1.5vmin] text-[17vmin] leading-none tabular-nums text-(--face-ink-muted)">{time}</span>
        <span className="mt-[3vmin] text-[2.2vmin] text-(--face-ink)">
          {nextAt === null ? 'No other alarms' : `Next: ${nextLabel(nextAt, new Date(renderNow))}`}
        </span>
        <span className="mt-[1.5vmin] text-[2.2vmin] text-(--face-ink-muted)">Tap to clear</span>
      </button>
    );
  }

  const endHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
  };
  const onDown = () => {
    downAt.current = Date.now();
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHolding(false);
      dismiss();
    }, HOLD_MS);
  };
  const onUp = () => {
    const pending = holdTimer.current !== null;
    const tap = Date.now() - downAt.current < TAP_MS;
    endHold();
    if (pending && tap) snoozeAlarm(alert, settings.snoozeMinutes, Date.now());
  };

  return (
    <button
      type="button"
      aria-label={`Alarm ${time}: tap to snooze, hold to stop`}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={endHold}
      onPointerCancel={endHold}
      className={`relative flex h-full w-full flex-col items-center justify-center text-center ${
        speaker ? 'theme-fade bg-(--face-bg) text-(--face-ink)' : 'alert-pulse'
      }`}
    >
      {speaker && (
        <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="500" cy="500" r="470" strokeWidth="18" className="fill-none stroke-(--color-accent)" />
          <circle cx="500" cy="500" r="430" strokeWidth="4" className="fill-none stroke-(--color-accent)" />
        </svg>
      )}
      <span className="relative text-[17vmin] leading-none tabular-nums">{time}</span>
      <span className="relative mt-[3vmin] text-[2.6vmin]">Tap to snooze {settings.snoozeMinutes} min</span>
      <span className={`relative mt-[1.5vmin] text-[2.2vmin] ${speaker ? 'text-(--face-ink-muted)' : ''}`}>Hold 2 s to stop</span>
      <span aria-hidden="true" className="relative mt-[2vmin] block h-[1vmin] w-[30vmin] overflow-hidden rounded-full bg-(--face-ghost)">
        <span
          className={`block h-full w-full origin-left rounded-full bg-(--color-accent) transition-transform ease-linear ${holding ? 'scale-x-100 duration-[2000ms]' : 'scale-x-0 duration-200'}`}
        />
      </span>
      {!speaker && (
        <span className="relative mt-[3vmin] rounded-full bg-(--face-bg) px-[2.4vmin] py-[1vmin] text-[2.2vmin] text-(--face-ink)">
          No speaker, flash only
        </span>
      )}
    </button>
  );
}
