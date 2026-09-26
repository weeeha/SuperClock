import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { AppProps } from '../../core/types';
import { setRadarMode, useRadar } from '../../core/radar';
import { breathingAppSchema } from '../../shared/schemas/app.breathing';

// How often the active app renews its breathing-mode lease. The server
// reverts the sensor to presence mode 90s after the last renewal, so a
// crashed or navigated-away kiosk can't pin the mode forever.
const LEASE_RENEW_MS = 30_000;

/** What the sensor is telling us, in the order the screen cares about.
 *  The accent belongs to a signal: 'no-radar' and 'absent' draw a resting
 *  ring in the subtle fill, so an instrument with nothing to report never
 *  looks the same as a live reading. */
type Phase = 'no-radar' | 'absent' | 'measuring' | 'reading';

const STATUS: Record<Phase, string> = {
  'no-radar': 'Radar not connected',
  absent: 'Nobody in range',
  measuring: 'Hold still, measuring',
  reading: 'breaths / min',
};

function formatDistance(mm: number | null): string | null {
  if (mm === null) return null;
  return mm < 1000 ? `${Math.round(mm / 10) * 10} mm` : `${(mm / 1000).toFixed(1)} m`;
}

/** Breathing screen — live respiration rate from the A121 radar,
 *  visualized as a ring that inflates and deflates at the measured pace. */
export default function BreathingApp({ isActive, config }: AppProps) {
  const radar = useRadar();
  // Calendar pattern: validate the admin's config against the schema, fall
  // back to the schema defaults (never a raw cast — decision D4).
  const parsed = breathingAppSchema.safeParse(config ?? {});
  const { showDistance } = parsed.success ? parsed.data : breathingAppSchema.parse({});

  // Lease breathing mode while this screen is the active app.
  useEffect(() => {
    if (!isActive) return;
    void setRadarMode('breathing');
    const timer = window.setInterval(() => void setRadarMode('breathing'), LEASE_RENEW_MS);
    return () => {
      window.clearInterval(timer);
      void setRadarMode('presence');
    };
  }, [isActive]);

  const rpm = radar?.breathing?.rpm ?? null;
  const distance = formatDistance(radar?.distanceMm ?? null);

  let phase: Phase;
  if (radar?.available !== true) phase = 'no-radar';
  else if (radar.present === false) phase = 'absent';
  else if (rpm === null) phase = 'measuring';
  else phase = 'reading';

  const reading = phase === 'reading';
  const hasSignal = phase === 'measuring' || reading;
  // One full breath takes 60/rpm seconds.
  const cycleSeconds = reading && rpm !== null ? 60 / rpm : 0;
  // The ring breathes only against a real rate: idling it at a plausible pace
  // would draw a breath nothing measured.
  const breathing = isActive && reading;

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black text-[hsl(var(--sheet-ink))]">
      <div className="relative flex items-center justify-center">
        {/* Outer halo breathes at the measured rate. Present only while there
            is one: a static glow is decoration, not a reading. */}
        {reading && (
          <motion.div
            className="absolute h-[58vmin] w-[58vmin] rounded-full"
            style={{
              background:
                'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 35%, transparent) 0%, transparent 70%)',
            }}
            animate={breathing ? { scale: [1, 1.22, 1], opacity: [0.5, 1, 0.5] } : { scale: 1, opacity: 0.5 }}
            transition={
              breathing
                ? { duration: cycleSeconds, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.8 }
            }
          />
        )}
        <motion.div
          className="flex h-[42vmin] w-[42vmin] flex-col items-center justify-center rounded-full border-2"
          style={{
            borderColor: hasSignal ? 'var(--color-accent)' : 'rgb(var(--fill-subtle))',
          }}
          animate={breathing ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={
            breathing
              ? { duration: cycleSeconds, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.8 }
          }
        >
          {reading && rpm !== null && (
            <span className="font-display text-[17vmin] leading-none tabular-nums">
              {rpm.toFixed(0)}
            </span>
          )}
          <span className="max-w-[30vmin] text-center text-[2.6vmin] text-[hsl(var(--sheet-ink))]/60">
            {STATUS[phase]}
          </span>
        </motion.div>
      </div>

      {/* Footer tells, placed absolutely so they never push the ring off the
          centre of the disc. Same position Calendar and Photo Frame use. */}
      <div className="absolute bottom-[7.5%] left-1/2 flex -translate-x-1/2 items-center gap-[2vmin] text-[2.2vmin] text-[hsl(var(--sheet-ink))]/50">
        {showDistance && distance && <span>{distance}</span>}
        {radar?.source === 'mock' && (
          <span className="rounded border border-[rgb(var(--fill))] px-[1vmin] py-[0.6vmin] uppercase tracking-wide">
            mock data
          </span>
        )}
      </div>
    </div>
  );
}
