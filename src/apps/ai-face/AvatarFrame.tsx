import { useEffect, useRef, useState } from 'react';
import type { AvatarDesign } from '../../shared/ai-face-designs';
import { adapterFor } from './adapters';
import { safeController } from './adapters/safe';
import type { AvatarController, FamilyAdapter } from './adapters/types';
import { initialGuard, stepGuard, type GuardLevel, type GuardState } from './frame-guard';
import type { AvatarState } from './sources/types';

export const UNMOUNT_AFTER_MS = 60_000;
export const ATTACH_TIMEOUT_MS = 5_000;
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

  useEffect(() => {
    if (active) return;
    const id = setTimeout(() => setMounted(false), UNMOUNT_AFTER_MS);
    return () => clearTimeout(id);
  }, [active]);

  if (!mounted) return null;
  return <Page key={design.id} design={design} state={state} active={active} adapter={adapter ?? adapterFor(design)} />;
}

function Page({ design, state, active, adapter }: Required<Props>) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const controllerRef = useRef<AvatarController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [level, setLevel] = useState<GuardLevel>('full');

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
    const started = Date.now();
    pollRef.current = setInterval(() => {
      let c: AvatarController | null = null;
      try {
        c = adapter.attach(win, design);
      } catch {
        // A page that throws while loading is not ready yet; the timeout below
        // turns a page that never recovers into the unavailable tell.
      }
      if (c) {
        if (pollRef.current) clearInterval(pollRef.current);
        controllerRef.current = safeController(c, design.id, () => setStatus('unavailable'));
        setStatus('ready');
      } else if (Date.now() - started >= ATTACH_TIMEOUT_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus('unavailable');
      }
    }, ATTACH_POLL_MS);
  };

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (status === 'ready') controllerRef.current?.apply(state);
  }, [state, status]);

  useEffect(() => {
    if (status === 'ready') controllerRef.current?.setPaused(!active || level === 'paused');
  }, [active, status, level]);

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

  const half = level !== 'full';
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
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
