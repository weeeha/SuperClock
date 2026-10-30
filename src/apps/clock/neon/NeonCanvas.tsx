import { useEffect, useRef } from 'react';
import { createKit, neonTime, renderFrame, type NeonFace } from './neon';

// 30 fps is smooth for glow and leaves the Pi room; a frame may arrive a
// touch early, so the gate allows a millisecond of slack.
const FRAME_MS = 1000 / 30 - 1;
// Reduced motion: the ambient clock stands still and the face redraws once
// a second, enough for the hands.
const REDUCED_FRAME_MS = 1000;
/** Device pixels are capped at 1x: the kiosk panel is 1080 CSS px at DPR 1,
 *  and glow gains nothing from more. */
const DPR_CAP = 1;

interface Props {
  isActive: boolean;
  face: NeonFace;
  /** 'soft' lowers the outer halo for a dark room. */
  glow: 'full' | 'soft';
}

/**
 * Hosts one neon face: a canvas filling the face, drawn by face.draw() every
 * animation frame while the face is active, never while it is not (KIO-1:
 * the effect below owns the loop and cancels it the moment isActive drops).
 * Hand angles come from neonTime(), which reads clockAngles, the formulas
 * useClockHands uses (KIO-3).
 */
export default function NeonCanvas({ isActive, face, glow }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isActive) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const kit = createKit(glow === 'soft' ? 0.35 : 1);
    const state = {};
    const t0 = performance.now();
    let raf = 0;
    let last = -Infinity;
    let broken = false;

    const fit = () => {
      const px = Math.max(1, Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, DPR_CAP) * (face.resolution ?? 1)));
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < (reduced ? REDUCED_FRAME_MS : FRAME_MS)) return;
      last = now;
      fit();
      try {
        renderFrame(ctx, face, kit, state, neonTime(new Date(), reduced ? 0 : (now - t0) / 1000));
      } catch (err) {
        // A face that throws once throws every frame: stop the loop and keep
        // the last good frame rather than flooding the log on a Pi for weeks.
        if (!broken) console.warn('[neon]', face.id, 'draw threw; face stopped', err);
        broken = true;
        cancelAnimationFrame(raf);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [isActive, face, glow]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
