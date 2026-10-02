import { useEffect, useState } from 'react';
import type { LeadViewProps } from '../../core/alerts/views';
import { clockText } from './alarm-schedule';

/** Board frame 4: a flat sunrise (no gradients) over the gentle-wake window,
 *  while the core layer wakes the panel and fades the night dimming out. */
export default function AlarmLead({ alert, hide }: LeadViewProps) {
  const [now, setNow] = useState(() => Date.now());
  // Steps once a minute on the minute: a chained one-shot, not an interval.
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const arm = () => {
      id = setTimeout(() => {
        setNow(Date.now());
        arm();
      }, 60_000 - (Date.now() % 60_000) + 50);
    };
    arm();
    return () => clearTimeout(id);
  }, []);

  return (
    <button
      type="button"
      aria-label="Hide until the alarm"
      onClick={hide}
      className="theme-fade relative flex h-full w-full flex-col items-center bg-(--face-bg)"
    >
      <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="500" cy="360" r="360" fillOpacity="0.15" className="fill-(--color-accent)" />
        <circle cx="500" cy="360" r="260" fillOpacity="0.3" className="fill-(--color-accent)" />
        <circle cx="500" cy="360" r="170" fillOpacity="0.5" className="fill-(--color-accent)" />
        <circle cx="500" cy="360" r="100" className="fill-(--color-accent)" />
      </svg>
      <span className="theme-fade absolute top-[60%] w-full text-center text-[17vmin] leading-none tabular-nums text-(--face-ink)">
        {clockText(now)}
      </span>
      <span className="theme-fade absolute top-[80%] w-full text-center text-[2.6vmin] text-(--face-ink-muted)">
        Alarm at {String(alert.payload.time ?? '')}
      </span>
    </button>
  );
}
