import { useClockHands } from '../../core/hooks/useClockHands';
import { apertureFaceSchema } from '../../shared/schemas/face.aperture';
import type { FaceProps } from './face-components';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Minute-window inner width: the seconds bar grows across it.
// Same width as the hour window — 280-unit tabular digits need ~330.
const BAR_X = 310;
const BAR_W = 380;

/**
 * Aperture plate — no hands. A plate covers the dial; the hour and minute
 * show through two windows and STEP (Pallweber-style), nothing sweeps.
 * The only motion and the only accent is the seconds bar along the bottom
 * edge of the minute window.
 */
export default function ApertureClock({ isActive, faceConfig }: FaceProps) {
  const { time } = useClockHands(isActive);

  const parsed = apertureFaceSchema.safeParse(faceConfig ?? {});
  const { format, showDate, secondsBar } = parsed.success
    ? parsed.data
    : apertureFaceSchema.parse({});

  const h24 = time.getHours();
  const hour = format === '12h' ? h24 % 12 || 12 : h24;
  const hourText = String(hour).padStart(2, '0');
  const minuteText = String(time.getMinutes()).padStart(2, '0');
  const meridiem = h24 < 12 ? 'AM' : 'PM';
  const dateText = `${DAYS[time.getDay()]} ${time.getDate()} ${MONTHS[time.getMonth()]}`;

  // Hour/minute text nodes only change value once an hour / once a minute;
  // React diffs the identical strings in between to zero DOM writes. The
  // seconds bar is the one per-second mutation.
  const barW = secondsBar ? (time.getSeconds() / 59) * BAR_W : 0;

  return (
    <div className="theme-fade flex h-full w-full items-center justify-center bg-(--face-bg)">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* The plate — one step off the ground so the windows read as cut */}
        <circle cx="500" cy="500" r="470" fill="var(--face-plate)" />
        <circle cx="500" cy="500" r="470" fill="none" stroke="var(--face-ink)" strokeWidth="3" />

        {/* Hour window */}
        <rect x="310" y="180" width="380" height="260" fill="var(--face-bg)" />
        <rect
          x="310"
          y="180"
          width="380"
          height="260"
          fill="none"
          stroke="var(--face-ink)"
          strokeWidth="3"
        />
        <text
          x="500"
          y="322"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="280"
          fontWeight="700"
          fill="var(--face-ink)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {hourText}
        </text>
        {format === '12h' && (
          <text
            x="730"
            y="322"
            dominantBaseline="central"
            fontSize="40"
            letterSpacing="4"
            fill="var(--face-ink-muted)"
          >
            {meridiem}
          </text>
        )}

        {/* Minute window */}
        <rect x={BAR_X} y="480" width={BAR_W} height="240" fill="var(--face-bg)" />
        <rect
          x={BAR_X}
          y="480"
          width={BAR_W}
          height="240"
          fill="none"
          stroke="var(--face-ink)"
          strokeWidth="3"
        />
        <text
          x="500"
          y="612"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="280"
          fontWeight="700"
          fill="var(--face-ink)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {minuteText}
        </text>

        {/* Seconds bar — the face's single accent quantity */}
        {secondsBar && (
          <rect x={BAR_X} y="726" width={barW.toFixed(1)} height="10" fill="var(--color-accent)" />
        )}

        {showDate && (
          <text
            x="500"
            y="820"
            textAnchor="middle"
            fontSize="40"
            letterSpacing="4"
            fill="var(--face-ink-muted)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {dateText}
          </text>
        )}
      </svg>
    </div>
  );
}
