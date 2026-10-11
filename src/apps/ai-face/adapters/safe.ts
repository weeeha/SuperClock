import type { AvatarController, AvatarSample } from './types';

const IDLE_SAMPLE: AvatarSample = { frame: 0, idle: true };

// Every call into a vendored page can throw (a WebGL context lost, a detached
// frame redrawing). The kiosk has no error boundary, so an escaped throw
// unmounts the whole root. This wrapper is the one place that rule is held,
// for every family: a throw is logged once per method, reported through
// onFault, and never propagates.
export function safeController(c: AvatarController, label: string, onFault: () => void): AvatarController {
  const logged = new Set<string>();
  const fault = (method: string, err: unknown) => {
    if (!logged.has(method)) {
      logged.add(method);
      console.warn('[ai-face]', label, `${method} threw`, err);
    }
    onFault();
  };
  return {
    apply(state) {
      try { c.apply(state); } catch (err) { fault('apply', err); }
    },
    setPaused(paused) {
      try { c.setPaused(paused); } catch (err) { fault('setPaused', err); }
    },
    setMuted(muted) {
      try { c.setMuted(muted); } catch (err) { fault('setMuted', err); }
    },
    // A fault is not slowness: report idle so the frame guard ignores it.
    sample() {
      try { return c.sample(); } catch (err) { fault('sample', err); return IDLE_SAMPLE; }
    },
    // The page is going away either way, so a throw here is swallowed.
    destroy() {
      try { c.destroy(); } catch { /* nothing left to protect */ }
    },
  };
}
