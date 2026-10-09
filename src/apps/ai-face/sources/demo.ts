import type { AvatarActivity, AvatarExpression } from '../../../shared/ai-face-designs';
import type { AvatarState, AvatarStateSource } from './types';

// One pass through a working session. Durations give each family time for its
// entry, hold and exit motion. Operational conditions (offline, permission
// denied) are never part of a demo: a demo must not claim a live failure.
export const DEMO_STEPS: readonly { activity: AvatarActivity; ms: number }[] = [
  { activity: 'starting', ms: 3000 },
  { activity: 'idle', ms: 8000 },
  { activity: 'listening', ms: 5000 },
  { activity: 'thinking', ms: 6000 },
  { activity: 'researching', ms: 6000 },
  { activity: 'working', ms: 8000 },
  { activity: 'answering', ms: 7000 },
  { activity: 'waiting', ms: 5000 },
  { activity: 'needs-input', ms: 5000 },
  { activity: 'complete', ms: 4000 },
  { activity: 'idle', ms: 6000 },
  { activity: 'error', ms: 4000 },
  { activity: 'sleeping', ms: 8000 },
];
export const DEMO_EXPRESSIONS: readonly AvatarExpression[] = [
  'neutral', 'curious', 'happy', 'playful', 'neutral', 'concerned', 'surprised', 'confused',
];
export const DEMO_EXPRESSION_MS = 15_000;

const CYCLE_MS = DEMO_STEPS.reduce((t, s) => t + s.ms, 0);

export function demoStateAt(elapsedMs: number): AvatarState {
  let t = ((elapsedMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  let activity = DEMO_STEPS[0].activity;
  for (const step of DEMO_STEPS) {
    if (t < step.ms) { activity = step.activity; break; }
    t -= step.ms;
  }
  const expression = DEMO_EXPRESSIONS[Math.floor(elapsedMs / DEMO_EXPRESSION_MS) % DEMO_EXPRESSIONS.length];
  return { activity, expression };
}

export function createDemoSource(now: () => number = () => Date.now()): AvatarStateSource {
  return {
    initial: demoStateAt(0),
    subscribe(cb) {
      const start = now();
      let last = demoStateAt(0);
      cb(last);
      const id = setInterval(() => {
        const next = demoStateAt(now() - start);
        if (next.activity !== last.activity || next.expression !== last.expression) {
          last = next;
          cb(next);
        }
      }, 500);
      return () => clearInterval(id);
    },
  };
}
