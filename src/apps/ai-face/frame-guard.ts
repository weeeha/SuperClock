import type { AvatarSample } from './adapters/types';

// Spec 3.6 (decision 8.1 = A): every design is offered everywhere; one that
// cannot keep up steps down to half resolution, then pauses with a tell.
// Only moving, non-idle samples are judged; a stalled counter is not evidence.
// Pure, so the thresholds are tested without a renderer.
export type GuardLevel = 'full' | 'half' | 'paused';

export interface GuardState {
  level: GuardLevel;
  fps: number[];
  lastFrame: number | null;
  lastAt: number | null;
  settleUntil: number;
}

export const GUARD = { minFps: 24, window: 5, settleMs: 10_000 } as const;

export function initialGuard(at: number): GuardState {
  return { level: 'full', fps: [], lastFrame: null, lastAt: null, settleUntil: at + GUARD.settleMs };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export function stepGuard(g: GuardState, s: AvatarSample, at: number): GuardState {
  if (g.level === 'paused') return g;
  if (s.idle) return { ...g, fps: [], lastFrame: null, lastAt: null };
  if (g.lastFrame === null || g.lastAt === null || s.frame < g.lastFrame || at <= g.lastAt) {
    return { ...g, lastFrame: s.frame, lastAt: at };
  }
  // Zero new frames is a stall (hidden or occluded renderer, throttled timers),
  // not slowness: a face that is too slow for the Pi still draws frames. Treat
  // it like an idle sample: restart the window, keep this sample as baseline.
  if (s.frame === g.lastFrame) return { ...g, fps: [], lastFrame: s.frame, lastAt: at };
  const fps = [...g.fps, (s.frame - g.lastFrame) / ((at - g.lastAt) / 1000)].slice(-GUARD.window);
  const next = { ...g, fps, lastFrame: s.frame, lastAt: at };
  if (at < g.settleUntil || fps.length < GUARD.window || median(fps) >= GUARD.minFps) return next;
  return {
    ...next,
    level: g.level === 'full' ? 'half' : 'paused',
    fps: [],
    settleUntil: at + GUARD.settleMs,
  };
}
