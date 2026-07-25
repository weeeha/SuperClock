import { useMemo } from 'react';
import { useClockHands } from '../../core/hooks/useClockHands';
import { daylightFaceSchema } from '../../shared/schemas/face.daylight';
import { sunTimes, type SunTimes } from './solar';
import type { FaceProps } from './face-components';

const BAND_R = 400;
const BAND_W = 60;
const CIRC = 2 * Math.PI * BAND_R;

/**
 * Daylight band — a 24-hour dial with NOON AT TOP (solar convention: hand
 * high = sun high; deliberately opposite to Depletion, whose datum is
 * midnight). One hand revolves per day; the ring shows sunrise→sunset in
 * accent and the rest in dusk. Sun times are computed locally (NOAA) — no
 * network, so there is no offline state to design.
 */
export default function DaylightClock({ isActive, faceConfig }: FaceProps) {
  const { time } = useClockHands(isActive);

  const parsed = daylightFaceSchema.safeParse(faceConfig ?? {});
  const { latitude, longitude, showTimes } = parsed.success
    ? parsed.data
    : daylightFaceSchema.parse({});

  // Sun times change once a day; key the memo on the calendar date.
  // The schema default (0,0) means "location not set", not Null Island:
  // real solar times there land shifted by the device's whole UTC offset —
  // plausible-looking and wrong everywhere. Until coordinates are set the
  // band is schematic 06:00–18:00 local, which is what the default promises.
  const dateKey = `${time.getFullYear()}-${time.getMonth()}-${time.getDate()}`;
  const sun = useMemo<SunTimes>(
    () =>
      latitude === 0 && longitude === 0
        ? { kind: 'normal', sunriseMin: 360, sunsetMin: 1080 }
        : sunTimes(time, latitude, longitude),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- time is folded into dateKey on purpose
    [dateKey, latitude, longitude],
  );

  // Noon at top: minute-of-day m maps to (m/1440*360 + 180) deg from 12.
  const toDeg = (m: number) => ((m / 1440) * 360 + 180) % 360;
  const minuteOfDay = time.getHours() * 60 + time.getMinutes();
  const handDeg = toDeg(minuteOfDay);
  const handRad = ((handDeg - 90) * Math.PI) / 180;
  const hx = 500 + 330 * Math.cos(handRad);
  const hy = 500 + 330 * Math.sin(handRad);

  // Daylight arc as a dasharray on the band circle. SVG dashes run from the
  // circle's start point (3 o'clock); rotate so the dash starts at sunrise.
  const band = useMemo(() => {
    if (sun.kind === 'polar-day') return { dash: `${CIRC} 0`, rotate: 0, sunrise: null, sunset: null };
    if (sun.kind === 'polar-night') return { dash: `0 ${CIRC}`, rotate: 0, sunrise: null, sunset: null };
    const sunriseDeg = toDeg(sun.sunriseMin);
    let span = toDeg(sun.sunsetMin) - sunriseDeg;
    if (span <= 0) span += 360;
    const arcLen = (span / 360) * CIRC;
    return {
      dash: `${arcLen.toFixed(1)} ${(CIRC - arcLen).toFixed(1)}`,
      // -90 moves the dash start from 3 o'clock to 12, then on to sunrise.
      rotate: sunriseDeg - 90,
      sunrise: sun.sunriseMin,
      sunset: sun.sunsetMin,
    };
  }, [sun]);

  const isDay =
    sun.kind === 'polar-day' ||
    (sun.kind === 'normal' && minuteOfDay >= sun.sunriseMin && minuteOfDay < sun.sunsetMin);

  const fmt = (m: number) => {
    const r = Math.round(m) % 1440;
    return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
  };

  return (
    <div className="theme-fade flex h-full w-full items-center justify-center bg-(--face-bg)">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        <circle cx="500" cy="500" r="470" fill="none" stroke="var(--face-ink)" strokeWidth="3" />

        {/* Night ring underneath, day arc on top of it */}
        <circle
          cx="500"
          cy="500"
          r={BAND_R}
          fill="none"
          stroke="var(--face-dusk)"
          strokeWidth={BAND_W}
        />
        <circle
          cx="500"
          cy="500"
          r={BAND_R}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={BAND_W}
          strokeDasharray={band.dash}
          transform={`rotate(${band.rotate.toFixed(2)} 500 500)`}
        />

        {/* 24 hour ticks outside the band — one dasharray'd circle */}
        <circle
          cx="500"
          cy="500"
          r="455"
          fill="none"
          stroke="var(--face-tick)"
          strokeWidth="24"
          strokeDasharray="6 113.119"
          transform="rotate(-90 500 500)"
          strokeDashoffset="3"
        />

        {/* Noon and midnight datums */}
        <line x1="500" y1="46" x2="500" y2="30" stroke="var(--face-ink)" strokeWidth="6" />
        <line x1="500" y1="954" x2="500" y2="970" stroke="var(--face-ink)" strokeWidth="6" />

        {/* The day hand: one revolution per day, sun disc at the tip */}
        <line
          x1="500"
          y1="500"
          x2={hx.toFixed(1)}
          y2={hy.toFixed(1)}
          stroke="var(--face-ink)"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <circle
          cx={hx.toFixed(1)}
          cy={hy.toFixed(1)}
          r="26"
          fill={isDay ? 'var(--color-accent)' : 'var(--face-dusk)'}
          stroke="var(--face-ink)"
          strokeWidth="3"
        />
        <circle cx="500" cy="500" r="14" fill="var(--face-ink)" />

        {showTimes && band.sunrise !== null && band.sunset !== null && (
          <>
            <text
              x="180"
              y="640"
              textAnchor="middle"
              fontSize="40"
              letterSpacing="2"
              fill="var(--face-ink-muted)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmt(band.sunrise)}
            </text>
            <text
              x="820"
              y="640"
              textAnchor="middle"
              fontSize="40"
              letterSpacing="2"
              fill="var(--face-ink-muted)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmt(band.sunset)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
