import { useEffect, useRef, useState } from 'react';
import { useClockHands } from '../../core/hooks/useClockHands';
import { useIsDark } from '../../core/apply-settings';
import { rallyFaceSchema } from '../../shared/schemas/face.rally';
import type { FaceProps } from './face-components';
import type { RallyOptions, RallyScene } from './rally/scene';

// 30 fps is plenty for a stage seen from 50 m up, and half the heat of 60 on a Pi.
const FRAME_MS = 1000 / 30;

/**
 * Rally — an endless, generated rally stage seen from above (low-poly, in the
 * manner of art of rally), with the time on top. The car drives itself, the
 * road never repeats, and on Auto the world, weather, light and car change on
 * their own. The 3D scene is content and owns its colours; night mode reaches
 * it as the night scene (headlights, moonlight), while the mat behind the
 * canvas reads --face-bg.
 */
export default function RallyClock({ isActive, faceConfig }: FaceProps) {
  const { time } = useClockHands(isActive);
  const dark = useIsDark();
  const parsed = rallyFaceSchema.safeParse(faceConfig ?? {});
  const { world, weather, light, car, speed, hour24 } = parsed.success ? parsed.data : rallyFaceSchema.parse({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RallyScene | null>(null);
  const optsRef = useRef<RallyOptions | null>(null);
  const [failed, setFailed] = useState(false);

  // Options flow into a live scene without rebuilding it.
  useEffect(() => {
    const o: RallyOptions = { world, weather, light, car, speedKmh: speed, night: dark };
    optsRef.current = o;
    sceneRef.current?.setOptions(o);
  }, [world, weather, light, car, speed, dark]);

  // The scene (and the three.js chunk) exists only while the face is shown;
  // nothing renders while it is inactive.
  useEffect(() => {
    if (!isActive || failed) return;
    let cancelled = false, raf = 0, lastDraw = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastDraw < FRAME_MS - 2) return;
      lastDraw = now;
      sceneRef.current?.frame(now);
    };
    import('./rally/scene')
      .then(({ createRallyScene }) => {
        const canvas = canvasRef.current, opts = optsRef.current;
        if (cancelled || !canvas || !opts) return;
        if (!sceneRef.current) sceneRef.current = createRallyScene(canvas, opts);
        raf = requestAnimationFrame(loop);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [isActive, failed]);

  // Give the GL context back when the face leaves the screen for good.
  useEffect(() => () => { sceneRef.current?.dispose(); sceneRef.current = null; }, []);

  const h = time.getHours();
  const hh = hour24 ? String(h).padStart(2, '0') : String(h % 12 || 12);
  const label = `${hh}:${String(time.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-(--face-bg)">
      {!failed && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}
      <div
        className="pointer-events-none absolute inset-x-0 top-[13%] text-center font-bold tabular-nums"
        style={{
          fontSize: '17vmin',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          // On the scene the digits need an ink that does not invert; on the bare mat they follow the palette.
          color: failed ? 'var(--face-ink)' : 'var(--sheet-ink)',
          // Two layers: a tight one for the glyph edges and a wide one, so the digits hold on snow and sand too.
          textShadow: failed
            ? undefined
            : '0 0.3vmin 0.9vmin color-mix(in srgb, var(--face-shadow) 55%, transparent), 0 0 4vmin color-mix(in srgb, var(--face-shadow) 35%, transparent)',
        }}
      >
        {label}
      </div>
      {failed && (
        <p className="absolute inset-x-0 top-[55%] text-center text-(--face-ink-muted)" style={{ fontSize: '3vmin' }}>
          This screen cannot draw the rally stage
        </p>
      )}
    </div>
  );
}
