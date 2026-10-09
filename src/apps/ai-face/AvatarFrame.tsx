import { useEffect, useRef, useState } from 'react';
import type { AvatarDesign } from '../../shared/ai-face-designs';
import { adapterFor } from './adapters';
import { safeController } from './adapters/safe';
import type { AvatarController, FamilyAdapter } from './adapters/types';
import { initialGuard, stepGuard, type GuardLevel, type GuardState } from './frame-guard';
import type { AvatarState } from './sources/types';

export const UNMOUNT_AFTER_MS = 60_000;
export const ATTACH_TIMEOUT_MS = 5_000;
// A paused or unavailable face is retried with a fresh mount (fresh guard,
// fresh attach) after this long while the app stays active: a throttle
// afternoon or a one-off fault should not freeze a wall clock for weeks.
export const RETRY_AFTER_MS = 30 * 60_000;
// Night shows `sleeping` for hours on a fanless Pi. The engine clamps that
// pose static after about 2.4 s but keeps redrawing every frame, so pause the
// page once the pose has settled.
export const SLEEP_SETTLE_MS = 3_000;
const ATTACH_POLL_MS = 100;

interface Props {
  design: AvatarDesign;
  state: AvatarState;
  active: boolean;
  adapter?: FamilyAdapter;
}

// Keeps the page mounted through a quick swipe away and back; frees GL
// contexts and decoders after a minute in the background (KIO-1).
export default function AvatarFrame({ design, state, active, adapter }: Props) {
  const [mounted, setMounted] = useState(active);
  if (active && !mounted) setMounted(true); // adjust state during render
  // Bumping the generation is a fresh mount of Page; `dead` is Page reporting
  // that it paused or became unavailable.
  const [generation, setGeneration] = useState(0);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    if (active) return;
    const id = setTimeout(() => setMounted(false), UNMOUNT_AFTER_MS);
    return () => clearTimeout(id);
  }, [active]);

  useEffect(() => {
    if (!active || !dead) return;
    const id = setTimeout(() => {
      setGeneration((g) => g + 1);
      setDead(false);
    }, RETRY_AFTER_MS);
    return () => clearTimeout(id);
  }, [active, dead]);

  if (!mounted) return null;
  return (
    <Page
      key={`${design.id}:${generation}`}
      design={design}
      state={state}
      active={active}
      adapter={adapter ?? adapterFor(design)}
      onDead={setDead}
    />
  );
}

function Page({ design, state, active, adapter, onDead }: Required<Props> & { onDead: (dead: boolean) => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const controllerRef = useRef<AvatarController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [level, setLevel] = useState<GuardLevel>('full');
  const [sleepSettled, setSleepSettled] = useState(false);

  // Attach: inject the kiosk stylesheet, then poll for the page API. Some
  // browsers fire load for about:blank first; attach only once.
  const onLoad = () => {
    if (controllerRef.current || pollRef.current) return;
    const win = iframeRef.current?.contentWindow;
    const doc = iframeRef.current?.contentDocument;
    if (!win || !doc) {
      setStatus('unavailable');
      return;
    }
    const style = doc.createElement('style');
    style.textContent = adapter.kioskCss;
    // A page that has not produced a root yet (jsdom, or a failed navigation)
    // has no <head>; give it one so the stylesheet has somewhere to live.
    const root = doc.documentElement ?? doc.appendChild(doc.createElement('html'));
    (doc.head ?? root.appendChild(doc.createElement('head'))).append(style);
    pollRef.current = setInterval(() => {
      let c: AvatarController | null = null;
      try {
        c = adapter.attach(win, design);
      } catch {
        // A page that throws while loading is not ready yet; the deadline
        // below turns a page that never recovers into the unavailable tell.
      }
      if (c) {
        if (pollRef.current) clearInterval(pollRef.current);
        controllerRef.current = safeController(c, design.id, () => setStatus('unavailable'));
        setStatus('ready');
      }
    }, ATTACH_POLL_MS);
  };

  // The attach deadline runs from mount, not from load, so a page whose load
  // never fires still ends in the tell.
  useEffect(() => {
    const id = setTimeout(() => {
      if (controllerRef.current) return;
      if (pollRef.current) clearInterval(pollRef.current);
      setStatus('unavailable');
    }, ATTACH_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    },
    [],
  );

  // An unavailable face is torn down, not hidden: the iframe below stops
  // rendering (freeing the document and GL context) and the controller is
  // destroyed, so nothing keeps drawing behind the tell.
  useEffect(() => {
    if (status !== 'unavailable') return;
    if (pollRef.current) clearInterval(pollRef.current);
    controllerRef.current?.destroy();
    controllerRef.current = null;
  }, [status]);

  // Sleeping settles to a static pose, so pause the page once it has.
  useEffect(() => {
    if (status !== 'ready' || !active || state.activity !== 'sleeping') return;
    const id = setTimeout(() => setSleepSettled(true), SLEEP_SETTLE_MS);
    return () => {
      clearTimeout(id);
      setSleepSettled(false);
    };
  }, [status, active, state.activity]);
  const asleep = sleepSettled && active && state.activity === 'sleeping';

  // Pause state first, then the state itself, so a reactivation runs the
  // entry animation against a running engine. The frame guard reads a paused
  // page as idle samples (the controller reports paused as idle), so a
  // sleeping pause is never mistaken for slowness.
  useEffect(() => {
    if (status === 'ready') controllerRef.current?.setPaused(!active || level === 'paused' || asleep);
  }, [active, status, level, asleep]);

  useEffect(() => {
    if (status === 'ready') controllerRef.current?.apply(state);
  }, [state, status]);

  // Frame guard, 1 Hz, only while active and attached.
  useEffect(() => {
    if (status !== 'ready' || !active || level === 'paused') return;
    let guard: GuardState = { ...initialGuard(Date.now()), level };
    const id = setInterval(() => {
      const c = controllerRef.current;
      if (!c) return;
      const s = c.sample();
      guard = stepGuard(guard, { frame: s.frame, idle: s.idle || document.hidden }, Date.now());
      if (guard.level !== level) setLevel(guard.level);
    }, 1000);
    return () => clearInterval(id);
  }, [status, active, level]);

  // Tell the parent when this mount is spent, so it can schedule a retry.
  const spent = status === 'unavailable' || level === 'paused';
  useEffect(() => {
    if (!spent) return;
    onDead(true);
    return () => onDead(false);
  }, [spent, onDead]);

  const half = level !== 'full';
  // The vendored artwork paints its own pure black stage and the injected page CSS
  // cannot read parent tokens, so the wrapper matches it.
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {status !== 'unavailable' && (
        <iframe
          ref={iframeRef}
          src={adapter.pageUrl(design)}
          title={design.name}
          onLoad={onLoad}
          className="absolute left-0 top-0 border-0 transition-opacity duration-300"
          style={{
            pointerEvents: 'none',
            width: half ? '50%' : '100%',
            height: half ? '50%' : '100%',
            transform: half ? 'scale(2)' : undefined,
            transformOrigin: '0 0',
            opacity: status === 'ready' ? 1 : 0,
          }}
        />
      )}
      {status === 'unavailable' && <Tell>Face unavailable</Tell>}
      {level === 'paused' && <Tell>Paused to keep the clock cool</Tell>}
    </div>
  );
}

function Tell({ children }: { children: string }) {
  return (
    <p className="absolute inset-x-0 bottom-[22%] text-center text-[2.4vmin] opacity-60 text-[hsl(var(--sheet-ink))]">{children}</p>
  );
}
