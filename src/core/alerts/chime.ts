// The alert chime: two sine notes synthesised with Web Audio (as Fitness does),
// so there is no asset to ship. Chromium runs with
// --autoplay-policy=no-user-gesture-required, so nothing needs unlocking.
import { STATIC_DEVICE_INFO } from '../../shared/capabilities';

export const CHIME_INTERVAL_MS = 2000;
const NOTES = [
  { hz: 880, at: 0 },
  { hz: 1320, at: 0.2 },
];
const NOTE_S = 0.18;

export interface Chime {
  start(): void;
  stop(): void;
}

export function createChime(makeContext: () => AudioContext = () => new AudioContext()): Chime {
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const ring = () => {
    if (!ctx) return;
    for (const note of NOTES) {
      const t = ctx.currentTime + note.at;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.hz;
      // Ramp rather than a hard stop; a square cut-off clicks audibly.
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + NOTE_S);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + NOTE_S + 0.02);
    }
  };

  return {
    start() {
      if (timer) return;
      try {
        ctx = makeContext();
      } catch {
        ctx = null; // no audio device: the screen is the alarm
        return;
      }
      ring();
      timer = setInterval(ring, CHIME_INTERVAL_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      if (ctx) {
        void ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}

/** Only clocks that declare the `audio` feature (fastclock's Fusion HAT). */
export function deviceHasAudio(deviceId: string | undefined): boolean {
  if (!deviceId) return false;
  const info = (STATIC_DEVICE_INFO as Record<string, { features: readonly string[] } | undefined>)[deviceId];
  return info?.features.includes('audio') ?? false;
}
