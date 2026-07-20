import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { AppProps } from '../../core/types';
import { setRadarMode, useRadar } from '../../core/radar';
import type { BreathingAppConfig } from '../../shared/schemas/app.breathing';

// How often the active app renews its breathing-mode lease. The server
// reverts the sensor to presence mode 90s after the last renewal, so a
// crashed or navigated-away kiosk can't pin the mode forever.
const LEASE_RENEW_MS = 30_000;

function formatDistance(mm: number | null): string | null {
  if (mm === null) return null;
  return mm < 1000 ? `${Math.round(mm / 10) * 10} mm` : `${(mm / 1000).toFixed(1)} m`;
}

/** Breathing screen — live respiration rate from the A121 radar,
 *  visualized as a ring that inflates and deflates at the measured pace. */
export default function BreathingApp({ isActive, config }: AppProps) {
  const radar = useRadar();
  const { showDistance = true } = (config ?? {}) as Partial<BreathingAppConfig>;

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
  const hasData = radar?.available === true;
  // One full breath takes 60/rpm seconds; idle at a calm 12 while searching.
  const cycleSeconds = 60 / (rpm ?? 12);

  let status: string;
  if (!hasData) status = 'Radar not connected';
  else if (radar.present === false) status = 'Nobody in range';
  else if (rpm === null) status = 'Hold still… measuring';
  else status = 'breaths / min';

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black text-white">
      <div className="relative flex items-center justify-center">
        {/* Outer halo breathes at the measured rate */}
        <motion.div
          className="absolute h-[58vmin] w-[58vmin] rounded-full"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 35%, transparent) 0%, transparent 70%)',
          }}
          animate={
            isActive && rpm !== null
              ? { scale: [1, 1.22, 1], opacity: [0.5, 1, 0.5] }
              : { scale: 1, opacity: 0.25 }
          }
          transition={
            isActive && rpm !== null
              ? { duration: cycleSeconds, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.8 }
          }
        />
        <motion.div
          className="flex h-[42vmin] w-[42vmin] flex-col items-center justify-center rounded-full border-2"
          style={{ borderColor: 'var(--color-accent)' }}
          animate={
            isActive && rpm !== null ? { scale: [1, 1.08, 1] } : { scale: 1 }
          }
          transition={
            isActive && rpm !== null
              ? { duration: cycleSeconds, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.8 }
          }
        >
          <span className="font-display text-8xl tabular-nums leading-none">
            {rpm !== null ? rpm.toFixed(0) : '—'}
          </span>
          <span className="mt-2 max-w-[30vmin] text-center text-lg text-white/60">
            {status}
          </span>
        </motion.div>
      </div>

      <div className="mt-10 flex items-center gap-4 text-base text-white/50">
        <span className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              radar?.present ? 'bg-green-400' : 'bg-white/30'
            }`}
          />
          {radar?.present ? 'presence' : 'no presence'}
        </span>
        {showDistance && distance && <span>{distance}</span>}
        {radar?.source === 'mock' && (
          <span className="rounded border border-white/30 px-1.5 py-0.5 text-xs uppercase tracking-wide">
            mock data
          </span>
        )}
      </div>
    </div>
  );
}
