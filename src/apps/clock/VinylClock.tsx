import { useEffect, useRef, useState } from 'react';
import { useClockHands } from '../../core/hooks/useClockHands';
import { resolveSpecColor, specOf } from '../../shared/part-meta';
import { vinylFaceSchema } from '../../shared/schemas/face.vinyl';
import { initialGuard, stepGuard, type GuardLevel, type GuardState } from '../ai-face/frame-guard';
import { handPoints } from './handPoints';
import { ARM, needlePoint, needleRadius } from './vinyl-geometry';
import vinylMeta from './VinylClock.meta.json';
import type { FaceProps } from './face-components';

/**
 * Vinyl — a record on a mat. The dial is the Radiant "Vinyl Grooves" WebGL
 * shader, vendored at public/shaders/vinyl-grooves.html and hosted in an
 * iframe; it paints only the record on a transparent canvas, so the kiosk's
 * --face-bg mat shows around it in both palettes. React draws everything
 * that must read a token: two hands from the meta's spec and a tonearm that
 * plays one side per hour (vinyl-geometry.ts). No second hand: the record
 * spins at real 33 rpm and that is the face's motion.
 *
 * The record stays dark in both palettes, so the hands and arm read
 * --sheet-ink, the role that does not invert; --face-ink would be black on
 * black by day.
 *
 * The frame is treated the way AvatarFrame treats a vendored avatar page:
 * paused whenever the face is inactive, unmounted a minute later (KIO-1,
 * frees the GL context), and watched by the frame guard, which steps the
 * page to half resolution and then pauses it when the Pi cannot keep 24 fps.
 * The guard samples on the hand tick from useClockHands, so this file runs
 * no timer of its own (KIO-3).
 */
export const SHADER_URL = '/shaders/vinyl-grooves.html';
export const UNMOUNT_AFTER_MS = 60_000;
export const ATTACH_TIMEOUT_MS = 5_000;

const spec = specOf(vinylMeta, 'VinylClock.meta.json');
// The sheet roles are HSL triplets (the quick-settings sheet reads them as
// hsl(var(--sheet-ink))), so the spec's ink is resolved by hand rather than
// through resolveSpecColor, which would emit a bare var() and an invalid colour.
const INK = spec.face.ink === '--sheet-ink' ? 'hsl(var(--sheet-ink))' : resolveSpecColor(spec.face.ink, {});

// The vendored page's ROTATION_SPEED is a multiplier on 33.333 rpm.
const RPM_SPEED: Record<'33' | '45', number> = { '33': 1, '45': 45 / 33.333 };
const SPECTRUM: Record<'prismatic' | 'warm', number> = { prismatic: 1, warm: 0 };

interface PageApi {
  getState(): { frame: number; paused: boolean; reducedMotion: boolean };
  setPaused(paused: boolean): void;
  setParam(name: string, value: number): void;
}

type Status = 'loading' | 'ready' | 'unavailable';

// Every call into the page can throw (a lost GL context, a detached frame).
// The kiosk has no error boundary, so this wrapper is the one place a throw
// is caught: logged once per method, reported through onFault, never
// propagated. getState reports the page as idle on a fault, so the frame
// guard does not read a broken page as a slow one.
function safeApi(api: PageApi, onFault: () => void): PageApi {
  const logged = new Set<string>();
  const fault = (method: string, err: unknown) => {
    if (!logged.has(method)) {
      logged.add(method);
      console.warn('[vinyl]', `${method} threw`, err);
    }
    onFault();
  };
  return {
    getState() {
      try { return api.getState(); } catch (err) { fault('getState', err); return { frame: 0, paused: true, reducedMotion: false }; }
    },
    setPaused(p) {
      try { api.setPaused(p); } catch (err) { fault('setPaused', err); }
    },
    setParam(name, value) {
      try { api.setParam(name, value); } catch (err) { fault('setParam', err); }
    },
  };
}

export default function VinylClock({ isActive, faceConfig }: FaceProps) {
  const parsed = vinylFaceSchema.safeParse(faceConfig ?? {});
  const { rpm, shimmer } = parsed.success ? parsed.data : vinylFaceSchema.parse({});
  const { time, hourDeg, minuteDeg } = useClockHands(isActive);

  // Keep the page through a quick swipe away and back; free it after a minute.
  const [mounted, setMounted] = useState(isActive);
  if (isActive && !mounted) setMounted(true); // adjust state during render
  useEffect(() => {
    if (isActive) return;
    const id = setTimeout(() => setMounted(false), UNMOUNT_AFTER_MS);
    return () => clearTimeout(id);
  }, [isActive]);

  const hour = handPoints(hourDeg, spec.hands.hour.tip);
  const minute = handPoints(minuteDeg, spec.hands.minute.tip);
  const needle = needlePoint(needleRadius(time.getMinutes() + time.getSeconds() / 60));

  return (
    <div className="theme-fade relative h-full w-full overflow-hidden bg-(--face-bg)">
      {mounted && (
        <Record key={`${rpm}:${shimmer}`} active={isActive} rpm={rpm} shimmer={shimmer} tick={time} />
      )}
      <svg viewBox={`0 0 ${spec.space} ${spec.space}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <Tonearm needle={needle} />
        <line x1={hour.x1} y1={hour.y1} x2={hour.x2} y2={hour.y2} stroke={INK} strokeWidth={spec.hands.hour.width} />
        <line
          x1={minute.x1}
          y1={minute.y1}
          x2={minute.x2}
          y2={minute.y2}
          stroke={INK}
          strokeWidth={spec.hands.minute.width}
        />
      </svg>
    </div>
  );
}

function Tonearm({ needle }: { needle: { x: number; y: number } }) {
  const { pivot } = ARM;
  // The headshell is the last stretch of the arm, drawn heavier.
  const dx = needle.x - pivot.x;
  const dy = needle.y - pivot.y;
  const len = Math.hypot(dx, dy);
  const headLen = 54;
  const hx = needle.x - (dx / len) * headLen;
  const hy = needle.y - (dy / len) * headLen;
  // Counterweight behind the pivot, on the arm's line.
  const cwx = pivot.x - (dx / len) * 46;
  const cwy = pivot.y - (dy / len) * 46;
  return (
    <g stroke={INK} fill={INK}>
      <line x1={cwx} y1={cwy} x2={pivot.x} y2={pivot.y} strokeWidth="22" strokeLinecap="round" />
      <circle cx={pivot.x} cy={pivot.y} r="24" stroke="none" />
      <line x1={pivot.x} y1={pivot.y} x2={hx} y2={hy} strokeWidth="9" strokeLinecap="round" />
      <line x1={hx} y1={hy} x2={needle.x} y2={needle.y} strokeWidth="18" strokeLinecap="butt" />
    </g>
  );
}

interface RecordProps {
  active: boolean;
  rpm: '33' | '45';
  shimmer: 'prismatic' | 'warm';
  /** The hand tick; the frame guard samples the page once per change. */
  tick: Date;
}

function Record({ active, rpm, shimmer, tick }: RecordProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiRef = useRef<PageApi | null>(null);
  const guardRef = useRef<GuardState | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [level, setLevel] = useState<GuardLevel>('full');

  // The vendored script runs while the page parses, so the API is there by
  // the time load fires; a page without it is not the vendored page.
  const onLoad = () => {
    const win = iframeRef.current?.contentWindow as (Window & { vinylGrooves?: PageApi }) | null | undefined;
    const api = win?.vinylGrooves;
    if (!api) {
      setStatus('unavailable');
      return;
    }
    apiRef.current = safeApi(api, () => setStatus('unavailable'));
    setStatus('ready');
  };

  // The deadline runs from mount, so a page whose load never fires still
  // ends in the tell rather than a blank mat.
  useEffect(() => {
    const id = setTimeout(() => {
      if (!apiRef.current) setStatus('unavailable');
    }, ATTACH_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    apiRef.current?.setParam('ROTATION_SPEED', RPM_SPEED[rpm]);
    apiRef.current?.setParam('SPECTRUM', SPECTRUM[shimmer]);
  }, [status, rpm, shimmer]);

  useEffect(() => {
    if (status !== 'ready') return;
    apiRef.current?.setPaused(!active || level === 'paused');
  }, [status, active, level]);

  // Frame guard, sampled once per hand tick (about 1 Hz) while the page runs.
  // The sample is taken a moment after the tick, in a callback, so the level
  // change is a reaction to the page's state and not a render cascade.
  useEffect(() => {
    if (status !== 'ready' || !active || level === 'paused') return;
    const id = setTimeout(() => {
      const api = apiRef.current;
      if (!api) return;
      const guard = guardRef.current ?? { ...initialGuard(Date.now()), level };
      const s = api.getState();
      const next = stepGuard(guard, { frame: s.frame, idle: s.paused || s.reducedMotion || document.hidden }, Date.now());
      guardRef.current = next;
      if (next.level !== level) setLevel(next.level);
    }, 0);
    return () => clearTimeout(id);
  }, [tick, status, active, level]);

  // Torn down, not hidden: an unmounted page must not keep drawing.
  useEffect(
    () => () => {
      apiRef.current?.setPaused(true);
      apiRef.current = null;
    },
    [],
  );

  const half = level !== 'full';
  return (
    <>
      {status !== 'unavailable' && (
        <iframe
          ref={iframeRef}
          src={SHADER_URL}
          title="Vinyl record"
          onLoad={onLoad}
          className="absolute left-0 top-0 border-0 transition-opacity duration-300"
          style={{
            pointerEvents: 'none',
            width: half ? '50%' : '100%',
            height: half ? '50%' : '100%',
            transform: half ? 'scale(2)' : undefined,
            transformOrigin: '0 0',
            opacity: status === 'ready' && level !== 'paused' ? 1 : 0,
          }}
        />
      )}
      {status === 'unavailable' && <Tell>Record unavailable</Tell>}
      {level === 'paused' && <Tell>Record paused to keep the clock cool</Tell>}
    </>
  );
}

function Tell({ children }: { children: string }) {
  return (
    <p className="absolute inset-x-0 bottom-[22%] text-center text-[2.4vmin] text-(--face-ink-muted)">{children}</p>
  );
}
