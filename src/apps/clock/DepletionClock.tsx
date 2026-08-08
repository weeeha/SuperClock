import { useMemo } from 'react';
import { useClockHands } from '../../core/hooks/useClockHands';
import { useDeviceConfig } from '../../core/device-config';
import { depletionFaceSchema } from '../../shared/schemas/face.depletion';
import { calendarDayState, awakeState, wedgePath } from './day-fraction';
import type { FaceProps } from './face-components';

/**
 * Depletion disc — a 24-hour dial, midnight at top, where the accent wedge
 * is the time remaining in the day. It drains to nothing at local midnight
 * and refills in a single frame (no animation, by design — see spec).
 *
 * No hands: a fixed hairline at 12 (the datum) and a heavy boundary at now.
 */
export default function DepletionClock({ isActive, faceConfig }: FaceProps) {
  const { time } = useClockHands(isActive);
  const deviceConfig = useDeviceConfig();

  const parsed = depletionFaceSchema.safeParse(faceConfig ?? {});
  const { cycle, ticks, readout } = parsed.success ? parsed.data : depletionFaceSchema.parse({});

  const night = deviceConfig?.settings.night;

  // The hook ticks every second; the geometry only changes per minute.
  // Memoising on minuteOfDay means React diffs identical output 59s in 60
  // and writes nothing to the DOM.
  const minuteOfDay = time.getHours() * 60 + time.getMinutes();
  const state = useMemo(() => {
    // Re-derive from a Date so DST days use real midnight boundaries; the
    // memo key is the minute, the computation uses the full timestamp.
    const now = new Date(time.getFullYear(), time.getMonth(), time.getDate(), 0, minuteOfDay);
    return cycle === 'awake'
      ? awakeState(now, night ? { start: night.start, end: night.end } : undefined)
      : calendarDayState(now);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- time is folded into minuteOfDay on purpose
  }, [minuteOfDay, cycle, night?.start, night?.end]);

  const remainingPath =
    state.remaining > 0 ? wedgePath(500, 500, 430, state.boundaryDeg, 360) : null;
  const spentPath = state.remaining < 1 ? wedgePath(500, 500, 430, 0, state.boundaryDeg) : null;

  const boundaryRad = ((state.boundaryDeg - 90) * Math.PI) / 180;
  const bx = 500 + 430 * Math.cos(boundaryRad);
  const by = 500 + 430 * Math.sin(boundaryRad);

  const hours = Math.floor(state.minutesLeft / 60);
  const mins = state.minutesLeft % 60;
  const readoutText = state.asleep
    ? `WAKE IN ${hours}H ${String(mins).padStart(2, '0')}M`
    : `${hours}H ${String(mins).padStart(2, '0')}M LEFT`;

  // Tick ring as one dasharray'd circle: dash 6 wide on circumference
  // 2*PI*455 = 2858.85; 24 ticks -> gap 113.12, 4 ticks -> gap 708.71.
  const tickRing =
    ticks === 'none' ? null : ticks === 'hours' ? '6 113.119' : '6 708.712';

  return (
    <div className="theme-fade flex h-full w-full items-center justify-center bg-(--face-bg)">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* Dial edge */}
        <circle cx="500" cy="500" r="470" fill="none" stroke="var(--face-ink)" strokeWidth="3" />

        {/* Spent, then remaining (accent) */}
        {spentPath && <path d={spentPath} fill="var(--face-spent)" />}
        {remainingPath && <path d={remainingPath} fill="var(--color-accent)" />}

        {/* Tick ring — one element, not 24 */}
        {tickRing && (
          <circle
            cx="500"
            cy="500"
            r="455"
            fill="none"
            stroke="var(--face-tick)"
            strokeWidth="24"
            strokeDasharray={tickRing}
            /* Rotate half a dash back so a tick is centred on 12 o'clock. */
            transform="rotate(-90 500 500)"
            strokeDashoffset="3"
          />
        )}

        {/* Midnight datum */}
        <line x1="500" y1="500" x2="500" y2="70" stroke="var(--face-ink)" strokeWidth="3" />

        {/* Now boundary — the only moving element */}
        <line
          x1="500"
          y1="500"
          x2={bx.toFixed(1)}
          y2={by.toFixed(1)}
          stroke="var(--face-ink)"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <circle cx="500" cy="500" r="14" fill="var(--face-ink)" />

        {readout === 'remaining' && (
          <text
            x="500"
            y="700"
            textAnchor="middle"
            fontSize="40"
            letterSpacing="4"
            fill="var(--face-ink-muted)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {readoutText}
          </text>
        )}
      </svg>
    </div>
  );
}
