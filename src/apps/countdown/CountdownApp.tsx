import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import { countdownAppSchema } from '../../shared/schemas/app.countdown';
import { countdownState, localToday, msUntilNextLocalMidnight, type RingView } from './countdown-state';
import { countdownCopy } from './countdown-copy';

// Ring geometry in the 1000-unit disc: outer edge at radius 460, inside the glass.
const R = 447;
const CIRCUMFERENCE = 2 * Math.PI * R;

function Ring({ ring }: { ring: Exclude<RingView, { missingStart: true }> }) {
  return (
    <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {ring.spent ? (
        <circle cx="500" cy="500" r={R} strokeWidth="26" className="fill-none stroke-(--face-ink-muted)" />
      ) : (
        <>
          <circle cx="500" cy="500" r={R} strokeWidth="26" className="fill-none stroke-(--face-ghost)" />
          <circle
            cx="500"
            cy="500"
            r={R}
            strokeWidth="26"
            strokeDasharray={`${CIRCUMFERENCE * ring.fraction} ${CIRCUMFERENCE}`}
            transform="rotate(-90 500 500)"
            className="fill-none stroke-(--color-accent)"
          />
        </>
      )}
    </svg>
  );
}

/** Countdown: days to a date, "Today" on it, days since after it. Re-renders
 *  once at local midnight, and only while it is the active app. */
export default function CountdownApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = countdownAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : countdownAppSchema.parse({});
  }, [config]);

  const [today, setToday] = useState(() => localToday(new Date()));

  // Catch a midnight crossed while inactive. Done during render ("adjust state
  // during render") because react-hooks/set-state-in-effect bans a synchronous
  // setState in the effect body.
  const [wasActive, setWasActive] = useState(isActive);
  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) setToday(localToday(new Date()));
  }

  useEffect(() => {
    if (!isActive) return;
    let id: ReturnType<typeof setTimeout>;
    const arm = () => {
      id = setTimeout(() => {
        setToday(localToday(new Date()));
        arm();
      }, msUntilNextLocalMidnight(new Date()) + 1000);
    };
    arm();
    return () => clearTimeout(id);
  }, [isActive]);

  const view = countdownState(today, cfg);
  const copy = countdownCopy(view, cfg);
  const ring = view.kind !== 'not-set-up' && view.ring && !('missingStart' in view.ring) ? view.ring : null;
  const ink = copy.muted ? 'text-(--face-ink-muted)' : 'text-(--face-ink)';

  if (view.kind === 'not-set-up') {
    return (
      <div className="theme-fade flex h-full w-full flex-col items-center justify-center gap-[1.5vmin] bg-(--face-bg) text-center">
        <p className="theme-fade text-[2.6vmin] font-medium text-(--face-ink)">{copy.headline}</p>
        <p className="theme-fade max-w-[52vmin] text-[2.2vmin] text-(--face-ink-muted)">{copy.line}</p>
      </div>
    );
  }

  return (
    <div className="theme-fade relative flex h-full w-full items-center justify-center bg-(--face-bg)">
      {ring && <Ring ring={ring} />}
      <div className="relative flex max-w-[62vmin] flex-col items-center text-center">
        <span className={`theme-fade text-[17vmin] leading-none tabular-nums ${ink}`}>{copy.headline}</span>
        {copy.line && <p className={`theme-fade mt-[3vmin] line-clamp-2 text-[2.6vmin] ${ink}`}>{copy.line}</p>}
        {copy.caption && (
          <p className="theme-fade mt-[1.5vmin] text-[2.2vmin] text-(--face-ink-muted)">{copy.caption}</p>
        )}
      </div>
    </div>
  );
}
