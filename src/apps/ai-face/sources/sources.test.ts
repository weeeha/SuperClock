import { describe, it, expect, vi, afterEach } from 'vitest';
import { DEMO_STEPS, DEMO_EXPRESSIONS, DEMO_EXPRESSION_MS, demoStateAt, createDemoSource } from './demo';
import { createFixedSource } from './fixed';
import { applyNight } from './night';
import { toExternalStore } from './store';
import { sourceFor } from './index';

afterEach(() => vi.useRealTimers());

const cycleMs = DEMO_STEPS.reduce((t, s) => t + s.ms, 0);

describe('demo source', () => {
  it('starts on the first step and the first expression', () => {
    expect(demoStateAt(0)).toEqual({ activity: DEMO_STEPS[0].activity, expression: DEMO_EXPRESSIONS[0] });
  });

  it('walks the steps and wraps around', () => {
    expect(demoStateAt(DEMO_STEPS[0].ms).activity).toBe(DEMO_STEPS[1].activity);
    expect(demoStateAt(cycleMs).activity).toBe(DEMO_STEPS[0].activity);
  });

  it('changes expression on its own slower clock', () => {
    expect(demoStateAt(DEMO_EXPRESSION_MS).expression).toBe(DEMO_EXPRESSIONS[1]);
  });

  it('covers every canonical activity across one cycle', () => {
    expect(new Set(DEMO_STEPS.map((s) => s.activity)).size).toBe(12);
  });

  it('emits on subscribe, emits changes, and stops its interval on unsubscribe', () => {
    vi.useFakeTimers();
    let t = 0;
    const seen: string[] = [];
    const off = createDemoSource(() => t).subscribe((s) => seen.push(s.activity));
    expect(seen).toEqual([DEMO_STEPS[0].activity]);
    t = DEMO_STEPS[0].ms;
    vi.advanceTimersByTime(500);
    expect(seen).toEqual([DEMO_STEPS[0].activity, DEMO_STEPS[1].activity]);
    off();
    t = DEMO_STEPS[0].ms + DEMO_STEPS[1].ms;
    vi.advanceTimersByTime(5000);
    expect(seen).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('fixed source', () => {
  it('emits exactly the configured state once', () => {
    const seen: unknown[] = [];
    createFixedSource({ activity: 'thinking', expression: 'curious' }).subscribe((s) => seen.push(s));
    expect(seen).toEqual([{ activity: 'thinking', expression: 'curious' }]);
  });
});

describe('sourceFor', () => {
  it('picks fixed with the configured state, demo otherwise', () => {
    expect(sourceFor({ source: 'fixed', activity: 'error', expression: 'concerned' }).initial)
      .toEqual({ activity: 'error', expression: 'concerned' });
    expect(sourceFor({ source: 'demo', activity: 'error', expression: 'concerned' }).initial)
      .toEqual(demoStateAt(0));
  });
});

describe('night', () => {
  const awake = { activity: 'answering', expression: 'happy' } as const;
  it('forces sleeping at night and keeps the expression', () => {
    expect(applyNight(awake, true, true)).toEqual({ activity: 'sleeping', expression: 'happy' });
  });
  it('returns to the source state when night ends', () => {
    expect(applyNight(awake, false, true)).toEqual(awake);
  });
  it('leaves the state alone when sleepAtNight is off', () => {
    expect(applyNight(awake, true, false)).toEqual(awake);
  });
});

describe('external store bridge', () => {
  it('starts from the source initial and follows emissions', () => {
    const store = toExternalStore(createFixedSource({ activity: 'waiting', expression: 'neutral' }));
    expect(store.getSnapshot()).toEqual({ activity: 'waiting', expression: 'neutral' });
    const onChange = vi.fn();
    store.subscribe(onChange)();
    expect(onChange).toHaveBeenCalled();
  });
});
