import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigation } from '../navigation';
import { useLocalOverrides, effectiveBrightness, effectiveNight } from '../local-overrides';

// Read-only Wi-Fi status (GET /api/device/network). A network TOGGLE on a
// device administered over wifi is a footgun, so the sheet only reports.
interface NetworkStatus {
  ssid: string | null;
  connected: boolean;
}

// Spring shared by the open animation AND the exit collapse. Kept in one place
// because AnimatePresence animates out the element from its LAST PRESENT render
// — during finger-tracking that render's `transition` is {duration:0}, so the
// exit must carry its own transition (inside `exit`) to slide rather than snap.
const SHEET_SPRING = { type: 'spring', stiffness: 300, damping: 32 } as const;

// Bottom quick-settings sheet: brightness + night mode + wifi status. Opened by
// the bottom-arc swipe (nav `settingsOpen`) and follows the live drag while the
// gesture is mid-flight (nav `peek.target === 'settings'`). It writes local
// overrides against the SAME night-aware bases apply-settings publishes via
// `syncBases` — reading `bases` here (never recomputing the night window) is
// what keeps the override from being spent on the next render.
export default function QuickSettings() {
  const settingsOpen = useNavigation((s) => s.settingsOpen);
  // Select a primitive that is non-zero ONLY during a live settings-peek, so a
  // future grid-peek write can't re-render this component. Already excludes the
  // open state, so `tracking` below is simply `peeking > 0`.
  const peeking = useNavigation((s) =>
    s.peek?.target === 'settings' && !s.settingsOpen ? s.peek.progress : 0,
  );
  const hideSettings = useNavigation((s) => s.hideSettings);
  const noteUserGesture = useNavigation((s) => s.noteUserGesture);
  const setBrightness = useLocalOverrides((s) => s.setBrightness);
  const setNight = useLocalOverrides((s) => s.setNight);
  const brightnessOverride = useLocalOverrides((s) => s.brightness);
  const nightOverride = useLocalOverrides((s) => s.night);
  const bases = useLocalOverrides((s) => s.bases);

  // Resolve against the published bases so the slider/toggle reflect whatever
  // apply-settings currently drives (config, override, or night baseline).
  const brightness = effectiveBrightness(bases.brightness, brightnessOverride) ?? 100;
  const nightOn = effectiveNight(bases.night, nightOverride);

  // `null` = not fetched yet; 'unavailable' = the endpoint itself failed (honest
  // tell, distinct from a genuine "not connected"); otherwise the live status.
  const [net, setNet] = useState<NetworkStatus | 'unavailable' | null>(null);
  useEffect(() => {
    if (!settingsOpen) return; // active-aware: no fetch while closed
    let cancelled = false;
    fetch('/api/device/network')
      .then((r) => {
        if (!r.ok) throw new Error(`network status ${r.status}`);
        return r.json();
      })
      .then((d: NetworkStatus) => {
        if (!cancelled) setNet(d);
      })
      .catch(() => {
        // Endpoint failure is NOT the same as "not connected" — don't fake a
        // radio state we couldn't read.
        if (!cancelled) setNet('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [settingsOpen]);

  // Finger-tracking exactly when a settings-peek exists (the selector already
  // rules out the open state). While tracking, the sheet follows 1:1 with no
  // spring; every other state (open, and the AnimatePresence exit) uses the
  // spring — see the exit note below.
  const tracking = peeking > 0;

  return (
    <AnimatePresence>
      {(settingsOpen || peeking > 0) && (
        <>
          {/* Scrim: tapping outside the sheet dismisses it. Only present once
              fully open — during a peek the drag still owns the surface. */}
          {settingsOpen && (
            <div className="absolute inset-0 z-40" onPointerDown={hideSettings} />
          )}
          <motion.div
            className="absolute inset-x-0 bottom-0 z-50 h-1/2 rounded-t-[50%_20%] bg-sheet/95 px-[14%] pt-[8%] backdrop-blur"
            initial={{ y: '100%' }}
            animate={{ y: settingsOpen ? '0%' : `${(1 - peeking) * 100}%` }}
            // Exit carries its OWN transition: AnimatePresence animates out the
            // element from its last present render, which during finger-tracking
            // had transition={{duration:0}}. A component-level transition alone
            // would snap; the spring here makes the sub-threshold release slide.
            exit={{ y: '100%', transition: SHEET_SPRING }}
            transition={tracking ? { duration: 0 } : SHEET_SPRING}
          >
            <div className="mx-auto mb-6 h-2 w-16 rounded-full bg-white/25" />

            <label className="block font-mono text-[2vmin] tracking-widest text-white/50">
              BRIGHTNESS
              <input
                type="range"
                min={20}
                max={100}
                value={brightness}
                onChange={(e) => {
                  setBrightness(Number(e.target.value), bases.brightness);
                  noteUserGesture();
                }}
                className="mt-2 w-full accent-white"
              />
            </label>

            <div className="mt-5 flex items-center justify-between">
              <span className="font-mono text-[2vmin] tracking-widest text-white/50">
                NIGHT MODE
              </span>
              <button
                type="button"
                aria-pressed={nightOn}
                onClick={() => {
                  setNight(!nightOn, bases.night);
                  noteUserGesture();
                }}
                className={`h-11 w-20 rounded-full transition-colors ${
                  nightOn ? 'bg-white/80' : 'bg-white/15'
                }`}
              >
                <span
                  className={`block h-9 w-9 rounded-full bg-black transition-transform ${
                    nightOn ? 'translate-x-10' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="font-mono text-[2vmin] tracking-widest text-white/50">
                WI-FI
              </span>
              <span className="text-[2.2vmin] text-white/70">
                {net === null
                  ? '…'
                  : net === 'unavailable'
                    ? 'status unavailable'
                    : net.connected
                      ? `${net.ssid} · connected`
                      : 'not connected'}
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
