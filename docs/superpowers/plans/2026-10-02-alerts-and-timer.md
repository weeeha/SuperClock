# Background Alerts + Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a core alert layer that can interrupt the kiosk from any app, and the Timer app as its first user.

**Architecture:** A persisted zustand alert store plus one scheduler hook own every alert boundary (fire and 5-minute settle). An `AlertLayer` mounted last in `App.tsx` renders the ringing app's registered view above everything, chimes on clocks with a speaker, and the shell (gestures, playlist, idle-return, presence shade) stands down while it rings. Timer keeps its state in a module-scope persisted store, schedules the core alert on start, and sets its duration with a dial band that claims its own drags.

**Tech Stack:** React 19, TypeScript (`verbatimModuleSyntax`, `erasableSyntaxOnly`, no enums), zustand, zod, Tailwind v4, @use-gesture/react, Vitest 4 + @testing-library/react (jsdom opt-in per file), Web Audio.

**Spec:** `docs/superpowers/specs/2026-10-02-alerts-and-timer-design.md`. Board: Designs page section Timer `51:863` (frames 0 to 4 and the dated update note).

## Global Constraints

- Checkout path contains spaces: quote every shell path. Worktrees need `npm ci` first.
- Kiosk type sizes: only `text-[17vmin]` (readouts), `text-[2.6vmin]` (labels), `text-[2.2vmin]` (captions). No other font size, no style-object `fontSize`.
- Kiosk colours: only `--face-bg`, `--face-ink`, `--face-ink-muted`, `--face-ghost`, `--color-accent`, via classes (`bg-(--face-bg)`, `stroke-(--face-ghost)`). No raw hex under `src/` (the colour ratchet counts it). SVG colour goes through classes, never `stroke="var(...)"`.
- Transitions name their properties (MOT-2): never `transition-all`.
- `src/apps/**`: any `setInterval` / `requestAnimationFrame` is gated on `isActive` (KIO-1). The core scheduler and the chime live in `src/core/alerts/`, outside KIO-1's scope.
- A component file exports only components (react-refresh lint). Helpers and types live in `.ts` files.
- ESLint runs the full react-hooks v7 Compiler ruleset, including `set-state-in-effect`: never call a `useState` setter synchronously in an effect body. Updating a zustand store from an effect is fine. To react to a prop change, use the "adjust state during render" pattern (see `src/apps/countdown/CountdownApp.tsx`).
- No emoji literals in chrome (ICO-2). Registry `icon` takes a `\u{...}` escape outside the pictograph planes.
- Copy: no exclamation marks, verb + object labels.
- Ring: 5 minutes (`RING_MS = 5 * 60_000`), then settled. Chime only when `alert.sound` and the device has the `audio` feature. One timer per clock; durations 0:30 to 60:00 in 30 s steps.
- Plan-level amendment to the spec (decided while planning): the settle boundary is a `settled: boolean` on the ringing alert, flipped by the scheduler (`settle()` action); `ringPhase(alert)` reads that flag. The layer holds no timer of its own.
- Work lands as local commits on branch `claude/alerts-timer`. No PR, no push. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 0: Branch

- [ ] **Step 1: Cut the task branch from the branch holding the spec**

```bash
cd "/Users/nickv/ClaudeCode Projects/SuperClock/.claude/worktrees/folders-question-e39caa"
git switch -c claude/alerts-timer
ls node_modules >/dev/null 2>&1 || npm ci
```

---

### Task 1: Alert store

**Files:**
- Create: `src/core/alerts/alert-store.ts`
- Test: `src/core/alerts/alert-store.test.ts`

**Interfaces:**
- Produces: `ScheduledAlert`, `RingingAlert` (adds `firedAt: number; settled: boolean`), `AlertState`, `RING_MS`, `ALERTS_STORAGE_KEY`, `createAlertStore(storage)`, `useAlerts` (singleton), `ringPhase(alert): 'ringing' | 'settled'`, `isAlertRinging(): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/alerts/alert-store.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ALERTS_STORAGE_KEY, createAlertStore, ringPhase, type ScheduledAlert } from './alert-store';
import { useNavigation } from '../navigation';

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const alert = (over: Partial<ScheduledAlert> = {}): ScheduledAlert => ({
  id: 'a', appId: 'timer', firesAt: 1000, sound: true, payload: {}, ...over,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('alert store', () => {
  it('schedules, replacing an alert with the same id', () => {
    const s = createAlertStore(memory());
    s.getState().schedule(alert({ firesAt: 1000 }));
    s.getState().schedule(alert({ firesAt: 2000 }));
    s.getState().schedule(alert({ id: 'b' }));
    expect(s.getState().scheduled.map((a) => [a.id, a.firesAt])).toEqual([['a', 2000], ['b', 1000]]);
  });

  it('cancels by id and ignores unknown ids', () => {
    const s = createAlertStore(memory());
    s.getState().schedule(alert());
    s.getState().cancel('nope');
    expect(s.getState().scheduled).toHaveLength(1);
    s.getState().cancel('a');
    expect(s.getState().scheduled).toEqual([]);
  });

  it('fires into ringing, unsettled, and leaves a second alert waiting', () => {
    const s = createAlertStore(memory());
    s.getState().schedule(alert({ id: 'a', firesAt: 1000 }));
    s.getState().schedule(alert({ id: 'b', firesAt: 1500 }));
    s.getState().fire('a', 1000);
    expect(s.getState().ringing).toMatchObject({ id: 'a', firedAt: 1000, settled: false });
    s.getState().fire('b', 1500);
    expect(s.getState().ringing?.id).toBe('a');
    expect(s.getState().scheduled.map((x) => x.id)).toEqual(['b']);
  });

  it('settles, and dismiss clears and counts as a user gesture', () => {
    const s = createAlertStore(memory());
    s.getState().schedule(alert());
    s.getState().fire('a', 1000);
    s.getState().settle();
    expect(ringPhase(s.getState().ringing!)).toBe('settled');
    vi.setSystemTime(424_242);
    s.getState().dismiss();
    expect(s.getState().ringing).toBeNull();
    expect(useNavigation.getState().lastGestureMs).toBe(424_242);
  });

  it('round-trips through storage', () => {
    const mem = memory();
    const a = createAlertStore(mem);
    a.getState().schedule(alert({ id: 'x', firesAt: 9000, payload: { durationMs: 300_000 } }));
    const b = createAlertStore(mem);
    expect(b.getState().scheduled).toEqual(a.getState().scheduled);
  });

  it('loads empty from corrupt or wrong-shape storage', () => {
    const mem = memory();
    mem.data.set(ALERTS_STORAGE_KEY, '{not json');
    expect(createAlertStore(mem).getState()).toMatchObject({ scheduled: [], ringing: null });
    mem.data.set(ALERTS_STORAGE_KEY, JSON.stringify({ scheduled: [{ id: 3 }], ringing: null }));
    expect(createAlertStore(mem).getState()).toMatchObject({ scheduled: [], ringing: null });
  });

  it('works without storage', () => {
    const s = createAlertStore(null);
    s.getState().schedule(alert());
    expect(s.getState().scheduled).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/core/alerts/alert-store.test.ts`
Expected: FAIL, `Failed to resolve import "./alert-store"`.

- [ ] **Step 3: Implement**

Create `src/core/alerts/alert-store.ts`:

```ts
// What is scheduled to interrupt the kiosk, and what is interrupting it now.
// Persisted so an alert survives app unmounts, Chromium's 6-hourly restart and
// deploys (spec docs/superpowers/specs/2026-10-02-alerts-and-timer-design.md).
import { create } from 'zustand';
import { z } from 'zod';
import { useNavigation } from '../navigation';

export interface ScheduledAlert {
  id: string;
  appId: string;
  firesAt: number;
  sound: boolean;
  payload: Record<string, unknown>;
}

export interface RingingAlert extends ScheduledAlert {
  firedAt: number;
  /** Flipped by the scheduler RING_MS after firedAt: pulse and chime stop. */
  settled: boolean;
}

export interface AlertState {
  scheduled: ScheduledAlert[];
  ringing: RingingAlert | null;
  schedule: (alert: ScheduledAlert) => void;
  cancel: (id: string) => void;
  fire: (id: string, firedAt: number) => void;
  settle: () => void;
  dismiss: () => void;
}

export const RING_MS = 5 * 60_000;
export const ALERTS_STORAGE_KEY = 'superclock:alerts:v1';

const scheduledSchema = z.object({
  id: z.string().min(1),
  appId: z.string().min(1),
  firesAt: z.number(),
  sound: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
});
const fileSchema = z.object({
  scheduled: z.array(scheduledSchema),
  ringing: scheduledSchema.extend({ firedAt: z.number(), settled: z.boolean() }).nullable(),
});

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Persisted = Pick<AlertState, 'scheduled' | 'ringing'>;

function load(storage: StorageLike | null): Persisted {
  const empty: Persisted = { scheduled: [], ringing: null };
  if (!storage) return empty;
  try {
    const raw = storage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = fileSchema.safeParse(JSON.parse(raw));
    // Losing an alert beats a kiosk that crashes on every boot.
    return parsed.success ? parsed.data : empty;
  } catch {
    return empty;
  }
}

/** storage is injectable so the store round-trips under test without a DOM. */
export function createAlertStore(storage: StorageLike | null) {
  const store = create<AlertState>()((set, get) => ({
    ...load(storage),
    schedule: (alert) =>
      set({ scheduled: [...get().scheduled.filter((a) => a.id !== alert.id), alert] }),
    cancel: (id) => {
      const { scheduled } = get();
      if (scheduled.some((a) => a.id === id)) set({ scheduled: scheduled.filter((a) => a.id !== id) });
    },
    fire: (id, firedAt) => {
      const { scheduled, ringing } = get();
      if (ringing) return; // one at a time; the scheduler fires the next after dismiss
      const alert = scheduled.find((a) => a.id === id);
      if (!alert) return;
      set({
        scheduled: scheduled.filter((a) => a.id !== id),
        ringing: { ...alert, firedAt, settled: false },
      });
    },
    settle: () => {
      const { ringing } = get();
      if (ringing && !ringing.settled) set({ ringing: { ...ringing, settled: true } });
    },
    dismiss: () => {
      if (!get().ringing) return;
      set({ ringing: null });
      // Playlist rotation resumes after its usual post-gesture cooldown.
      useNavigation.getState().noteUserGesture();
    },
  }));
  store.subscribe((s) => {
    if (!storage) return;
    try {
      storage.setItem(ALERTS_STORAGE_KEY, JSON.stringify({ scheduled: s.scheduled, ringing: s.ringing }));
    } catch {
      // Full or blocked storage: the alert still rings this session.
    }
  });
  return store;
}

const defaultStorage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

export const useAlerts = createAlertStore(defaultStorage);

export function ringPhase(alert: RingingAlert): 'ringing' | 'settled' {
  return alert.settled ? 'settled' : 'ringing';
}

/** Non-hook read for the shell's plain functions (gestures, idle, playlist). */
export function isAlertRinging(): boolean {
  return useAlerts.getState().ringing !== null;
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run src/core/alerts/alert-store.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/alerts/alert-store.ts src/core/alerts/alert-store.test.ts
git commit -m "feat(alerts): persisted alert store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Scheduler

**Files:**
- Create: `src/core/alerts/scheduler.ts`
- Test: `src/core/alerts/scheduler.test.ts`

**Interfaces:**
- Consumes: `useAlerts`, `RING_MS`, `ScheduledAlert`, `RingingAlert` (Task 1).
- Produces: `MAX_TIMEOUT_MS`, `type Plan`, `planNext(scheduled, ringing, now): Plan`, `useAlertScheduler(): void`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/alerts/scheduler.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MAX_TIMEOUT_MS, planNext, useAlertScheduler } from './scheduler';
import { RING_MS, useAlerts, type ScheduledAlert, type RingingAlert } from './alert-store';

const a = (id: string, firesAt: number): ScheduledAlert => ({ id, appId: 'timer', firesAt, sound: false, payload: {} });
const ringingAt = (firedAt: number, settled = false): RingingAlert => ({ ...a('r', firedAt), firedAt, settled });

describe('planNext', () => {
  it('is idle with nothing scheduled', () => {
    expect(planNext([], null, 0)).toEqual({ kind: 'idle' });
  });
  it('waits for the earliest alert', () => {
    expect(planNext([a('x', 5000), a('y', 3000)], null, 1000)).toEqual({ kind: 'wait', ms: 2000 });
  });
  it('fires a past-due alert', () => {
    expect(planNext([a('x', 5000), a('y', 900)], null, 1000)).toEqual({ kind: 'fire', alert: a('y', 900) });
  });
  it('clamps very long waits', () => {
    expect(planNext([a('x', 10 ** 13)], null, 0)).toEqual({ kind: 'wait', ms: MAX_TIMEOUT_MS });
  });
  it('waits for the settle boundary while ringing, ignoring the queue', () => {
    expect(planNext([a('x', 0)], ringingAt(1000), 2000)).toEqual({ kind: 'wait', ms: RING_MS - 1000 });
  });
  it('settles when the boundary has passed', () => {
    expect(planNext([], ringingAt(0), RING_MS)).toEqual({ kind: 'settle' });
  });
  it('is idle once settled, until dismissed', () => {
    expect(planNext([a('x', 0)], ringingAt(0, true), RING_MS * 2)).toEqual({ kind: 'idle' });
  });
});

describe('useAlertScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    useAlerts.setState({ scheduled: [], ringing: null });
  });
  afterEach(() => vi.useRealTimers());

  it('fires an alert when its time comes, then settles after RING_MS', () => {
    renderHook(() => useAlertScheduler());
    act(() => useAlerts.getState().schedule(a('t', 100_000 + 5000)));
    act(() => vi.advanceTimersByTime(4999));
    expect(useAlerts.getState().ringing).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(useAlerts.getState().ringing).toMatchObject({ id: 't', firedAt: 105_000, settled: false });
    act(() => vi.advanceTimersByTime(RING_MS));
    expect(useAlerts.getState().ringing?.settled).toBe(true);
  });

  it('fires a past-due alert on mount with its true firedAt', () => {
    useAlerts.setState({ scheduled: [a('t', 40_000)], ringing: null });
    renderHook(() => useAlertScheduler());
    expect(useAlerts.getState().ringing).toMatchObject({ id: 't', firedAt: 40_000 });
  });

  it('fires the queued alert after dismiss', () => {
    renderHook(() => useAlertScheduler());
    act(() => {
      useAlerts.getState().schedule(a('one', 100_000));
      useAlerts.getState().schedule(a('two', 100_000));
    });
    expect(useAlerts.getState().ringing?.id).toBe('one');
    act(() => useAlerts.getState().dismiss());
    expect(useAlerts.getState().ringing?.id).toBe('two');
  });

  it('re-plans when the page becomes visible', () => {
    renderHook(() => useAlertScheduler());
    act(() => useAlerts.getState().schedule(a('t', 100_000 + 60_000)));
    // Simulate a suspended page: the clock jumps past firesAt without the timer firing.
    vi.setSystemTime(100_000 + 61_000);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(useAlerts.getState().ringing?.id).toBe('t');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/core/alerts/scheduler.test.ts`
Expected: FAIL, `Failed to resolve import "./scheduler"`.

- [ ] **Step 3: Implement**

Create `src/core/alerts/scheduler.ts`:

```ts
// One clock for every alert boundary: when the earliest scheduled alert fires,
// and when a ringing one settles. The board's deliberate exception to "only
// tick while active" — a background alert that dies with its app is useless —
// kept to a single timeout, with no re-render between boundaries.
import { useEffect, useState } from 'react';
import { RING_MS, useAlerts, type RingingAlert, type ScheduledAlert } from './alert-store';

/** setTimeout's ceiling; longer waits simply re-plan when it elapses. */
export const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export type Plan =
  | { kind: 'idle' }
  | { kind: 'fire'; alert: ScheduledAlert }
  | { kind: 'settle' }
  | { kind: 'wait'; ms: number };

export function planNext(scheduled: ScheduledAlert[], ringing: RingingAlert | null, now: number): Plan {
  if (ringing) {
    if (ringing.settled) return { kind: 'idle' }; // the queue waits for dismiss
    const settleAt = ringing.firedAt + RING_MS;
    return settleAt <= now ? { kind: 'settle' } : { kind: 'wait', ms: Math.min(settleAt - now, MAX_TIMEOUT_MS) };
  }
  if (scheduled.length === 0) return { kind: 'idle' };
  const earliest = scheduled.reduce((x, y) => (y.firesAt < x.firesAt ? y : x));
  if (earliest.firesAt <= now) return { kind: 'fire', alert: earliest };
  return { kind: 'wait', ms: Math.min(earliest.firesAt - now, MAX_TIMEOUT_MS) };
}

/** Mount once, in App. */
export function useAlertScheduler(): void {
  const scheduled = useAlerts((s) => s.scheduled);
  const ringing = useAlerts((s) => s.ringing);
  const [wake, setWake] = useState(0);

  useEffect(() => {
    const plan = planNext(scheduled, ringing, Date.now());
    if (plan.kind === 'fire') {
      // Its true firedAt, so an alert that came due during a restart rings only
      // for what is left of its window.
      useAlerts.getState().fire(plan.alert.id, plan.alert.firesAt);
      return;
    }
    if (plan.kind === 'settle') {
      useAlerts.getState().settle();
      return;
    }
    if (plan.kind === 'idle') return;
    const id = setTimeout(() => setWake((w) => w + 1), plan.ms);
    return () => clearTimeout(id);
  }, [scheduled, ringing, wake]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) setWake((w) => w + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run src/core/alerts/scheduler.test.ts`
Expected: all pass. If ESLint later reports `wake` as an unnecessary dependency, keep it and add the one-line disable `// eslint-disable-next-line react-hooks/exhaustive-deps` above the deps array with the reason "wake is the re-plan trigger" (the same idiom `playlist.ts` uses).

- [ ] **Step 5: Commit**

```bash
git add src/core/alerts/scheduler.ts src/core/alerts/scheduler.test.ts
git commit -m "feat(alerts): one-timeout scheduler for fire and settle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Chime

**Files:**
- Create: `src/core/alerts/chime.ts`
- Test: `src/core/alerts/chime.test.ts`

**Interfaces:**
- Produces: `CHIME_INTERVAL_MS`, `interface Chime { start(): void; stop(): void }`, `createChime(makeContext?: () => AudioContext): Chime`, `deviceHasAudio(deviceId: string | undefined): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/alerts/chime.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CHIME_INTERVAL_MS, createChime, deviceHasAudio } from './chime';

class FakeContext {
  currentTime = 0;
  oscillators = 0;
  closed = false;
  destination = {};
  createOscillator() {
    this.oscillators += 1;
    return { type: '', frequency: { value: 0 }, connect: (n: unknown) => n, start() {}, stop() {} };
  }
  createGain() {
    const node = {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect: (n: unknown) => n,
    };
    return node;
  }
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createChime', () => {
  it('plays two notes at once and repeats every interval until stopped', () => {
    const ctx = new FakeContext();
    const chime = createChime(() => ctx as unknown as AudioContext);
    chime.start();
    expect(ctx.oscillators).toBe(2);
    vi.advanceTimersByTime(CHIME_INTERVAL_MS);
    expect(ctx.oscillators).toBe(4);
    chime.stop();
    expect(ctx.closed).toBe(true);
    vi.advanceTimersByTime(CHIME_INTERVAL_MS * 3);
    expect(ctx.oscillators).toBe(4);
  });

  it('is silent, not broken, when no AudioContext can be made', () => {
    const chime = createChime(() => {
      throw new Error('no audio');
    });
    expect(() => chime.start()).not.toThrow();
    expect(() => chime.stop()).not.toThrow();
  });
});

describe('deviceHasAudio', () => {
  it('follows the device feature flags', () => {
    expect(deviceHasAudio('superclock-fast')).toBe(true);
    expect(deviceHasAudio('superclock-small')).toBe(false);
    expect(deviceHasAudio('superclock-square')).toBe(false);
    expect(deviceHasAudio(undefined)).toBe(false);
    expect(deviceHasAudio('not-a-device')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/core/alerts/chime.test.ts`
Expected: FAIL, `Failed to resolve import "./chime"`.

- [ ] **Step 3: Implement**

Create `src/core/alerts/chime.ts`:

```ts
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
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run src/core/alerts/chime.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/alerts/chime.ts src/core/alerts/chime.test.ts
git commit -m "feat(alerts): synthesised chime, gated on the device audio flag

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Alert views, the layer, and mounting it

**Files:**
- Create: `src/core/alerts/views.ts`, `src/core/alerts/AlertLayer.tsx`
- Modify: `src/App.tsx`
- Test: `src/core/alerts/AlertLayer.test.tsx`

**Interfaces:**
- Consumes: `useAlerts`, `ringPhase` (Task 1); `useAlertScheduler` (Task 2); `createChime`, `deviceHasAudio` (Task 3); `useDeviceConfig` from `src/core/device-config.ts`.
- Produces: `interface AlertViewProps { alert: RingingAlert; phase: 'ringing' | 'settled'; dismiss: () => void }`, `registerAlertView(appId, view)`, `getAlertView(appId)`, default export `AlertLayer`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/alerts/AlertLayer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import AlertLayer from './AlertLayer';
import { registerAlertView, type AlertViewProps } from './views';
import { useAlerts, type RingingAlert } from './alert-store';

const chime = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock('./chime', async (orig) => ({
  ...(await orig<typeof import('./chime')>()),
  createChime: () => chime,
}));
const config = vi.hoisted(() => ({ deviceId: 'superclock-fast' }));
vi.mock('../device-config', () => ({ useDeviceConfig: () => config }));

function TestView({ phase, dismiss }: AlertViewProps) {
  return (
    <button type="button" onClick={dismiss}>
      test view {phase}
    </button>
  );
}
registerAlertView('test-app', TestView);

const ringing = (over: Partial<RingingAlert> = {}): RingingAlert => ({
  id: 'r', appId: 'test-app', firesAt: 0, firedAt: 0, sound: true, settled: false, payload: {}, ...over,
});

beforeEach(() => {
  chime.start.mockClear();
  chime.stop.mockClear();
  config.deviceId = 'superclock-fast';
  useAlerts.setState({ scheduled: [], ringing: null });
});
afterEach(cleanup);

describe('AlertLayer', () => {
  it('renders nothing when nothing rings', () => {
    const { container } = render(<AlertLayer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the registered view with its phase, above everything', () => {
    useAlerts.setState({ ringing: ringing() });
    const { container } = render(<AlertLayer />);
    expect(screen.getByText('test view ringing')).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain('z-[9500]');
  });

  it('dismisses through the view', () => {
    useAlerts.setState({ ringing: ringing() });
    render(<AlertLayer />);
    fireEvent.click(screen.getByText('test view ringing'));
    expect(useAlerts.getState().ringing).toBeNull();
  });

  it('falls back to a dismissable view for an app that registered none', () => {
    useAlerts.setState({ ringing: ringing({ appId: 'nobody' }) });
    render(<AlertLayer />);
    fireEvent.click(screen.getByText('Tap to dismiss'));
    expect(useAlerts.getState().ringing).toBeNull();
  });

  it('chimes only while ringing, with sound, on a clock with audio', () => {
    useAlerts.setState({ ringing: ringing() });
    render(<AlertLayer />);
    expect(chime.start).toHaveBeenCalledTimes(1);
    act(() => useAlerts.getState().settle());
    expect(chime.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText('test view settled')).toBeTruthy();
  });

  it('never chimes without sound or without the audio flag', () => {
    useAlerts.setState({ ringing: ringing({ sound: false }) });
    const { unmount } = render(<AlertLayer />);
    unmount();
    config.deviceId = 'superclock-small';
    useAlerts.setState({ ringing: ringing() });
    render(<AlertLayer />);
    expect(chime.start).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/core/alerts/AlertLayer.test.tsx`
Expected: FAIL, `Failed to resolve import "./AlertLayer"`.

- [ ] **Step 3: Implement the view registry**

Create `src/core/alerts/views.ts`:

```ts
// What each app's alert looks like. Apps register from their index.ts; the
// layer looks the view up by the ringing alert's appId.
import type { ComponentType } from 'react';
import type { RingingAlert } from './alert-store';

export interface AlertViewProps {
  alert: RingingAlert;
  phase: 'ringing' | 'settled';
  dismiss: () => void;
}

const views = new Map<string, ComponentType<AlertViewProps>>();

export function registerAlertView(appId: string, view: ComponentType<AlertViewProps>): void {
  views.set(appId, view);
}

export function getAlertView(appId: string): ComponentType<AlertViewProps> | undefined {
  return views.get(appId);
}
```

- [ ] **Step 4: Implement the layer**

Create `src/core/alerts/AlertLayer.tsx`:

```tsx
import { Suspense, useEffect } from 'react';
import { useAlerts, ringPhase } from './alert-store';
import { getAlertView, type AlertViewProps } from './views';
import { createChime, deviceHasAudio } from './chime';
import { useDeviceConfig } from '../device-config';

// An alert whose app registered no view still has to be clearable.
function FallbackAlert({ dismiss }: AlertViewProps) {
  return (
    <button
      type="button"
      onClick={dismiss}
      className="theme-fade flex h-full w-full flex-col items-center justify-center gap-[1.5vmin] bg-(--face-bg) text-center"
    >
      <span className="text-[2.6vmin] font-medium text-(--face-ink)">Alert</span>
      <span className="text-[2.2vmin] text-(--face-ink-muted)">Tap to dismiss</span>
    </button>
  );
}

/** Mounted last in App: above every app, the grid, quick settings and the
 *  presence shade (z-9000); below only the dev gesture-debug badge (z-9999). */
export default function AlertLayer() {
  const ringing = useAlerts((s) => s.ringing);
  const dismiss = useAlerts((s) => s.dismiss);
  const deviceId = useDeviceConfig()?.deviceId;
  const shouldChime = Boolean(ringing && !ringing.settled && ringing.sound && deviceHasAudio(deviceId));

  useEffect(() => {
    if (!shouldChime) return;
    const chime = createChime();
    chime.start();
    return () => chime.stop();
  }, [shouldChime]);

  if (!ringing) return null;
  const View = getAlertView(ringing.appId) ?? FallbackAlert;
  return (
    <div role="alertdialog" aria-label="Alert" className="fixed inset-0 z-[9500]">
      <Suspense fallback={null}>
        <View alert={ringing} phase={ringPhase(ringing)} dismiss={dismiss} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 5: Mount it**

In `src/App.tsx`, add the imports after the `PresenceShade` import:

```ts
import AlertLayer from './core/alerts/AlertLayer';
import { useAlertScheduler } from './core/alerts/scheduler';
```

call the scheduler after `useApplySettings();`:

```ts
  useAlertScheduler();
```

and render the layer directly after `<PresenceShade />`:

```tsx
      <AlertLayer />
```

- [ ] **Step 6: Run the tests and the suite**

Run: `npx vitest run src/core/alerts && npx vitest run`
Expected: alerts tests pass; the whole suite is green (nothing else changed behaviour yet).

- [ ] **Step 7: Commit**

```bash
git add src/core/alerts/views.ts src/core/alerts/AlertLayer.tsx src/core/alerts/AlertLayer.test.tsx src/App.tsx
git commit -m "feat(alerts): AlertLayer above every surface, app-registered views, fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The shell stands down while an alert rings

**Files:**
- Modify: `src/core/gesture-zones.ts` (add `isClaimedTarget`), `src/core/hooks/useGestures.ts`, `src/core/playlist.ts`, `src/core/hooks/useIdleReturn.ts`, `src/core/components/PresenceShade.tsx`
- Test: `src/core/gesture-claim.test.ts` (new), `src/core/playlist-advance.test.ts` (new), `src/core/hooks/useIdleReturn.test.ts` (extend), `src/core/components/PresenceShade.test.tsx` (new)

**Interfaces:**
- Consumes: `isAlertRinging`, `useAlerts` (Task 1).
- Produces: `isClaimedTarget(target: EventTarget | null): boolean` in `gesture-zones.ts`; `shouldAdvance(now: number, lastGestureMs: number, ringing: boolean): boolean` in `playlist.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/gesture-claim.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isClaimedTarget } from './gesture-zones';

describe('isClaimedTarget', () => {
  it('is true inside an element that claims the gesture, including SVG', () => {
    document.body.innerHTML = `
      <div data-gesture="claim"><span id="inner"></span></div>
      <svg><circle id="band" data-gesture="claim"></circle></svg>
      <p id="free"></p>`;
    expect(isClaimedTarget(document.getElementById('inner'))).toBe(true);
    expect(isClaimedTarget(document.getElementById('band'))).toBe(true);
    expect(isClaimedTarget(document.getElementById('free'))).toBe(false);
    expect(isClaimedTarget(null)).toBe(false);
  });
});
```

Create `src/core/playlist-advance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shouldAdvance } from './playlist';

describe('shouldAdvance', () => {
  it('advances only after the gesture cooldown and never while an alert rings', () => {
    expect(shouldAdvance(100_000, 0, false)).toBe(true);
    expect(shouldAdvance(100_000, 90_000, false)).toBe(false); // 10 s after a gesture
    expect(shouldAdvance(100_000, 0, true)).toBe(false);
  });
});
```

In `src/core/hooks/useIdleReturn.test.ts`, add `import { useAlerts } from '../alerts/alert-store';` with the other imports, add `useAlerts.setState({ scheduled: [], ringing: null });` as the last line of the existing `beforeEach`, and append inside `describe('checkIdle', ...)`:

```ts
  it('does nothing while an alert rings', () => {
    useNavigation.getState().showGrid();
    useAlerts.setState({
      ringing: { id: 'r', appId: 'timer', firesAt: 0, firedAt: 0, sound: false, settled: false, payload: {} },
    });
    vi.advanceTimersByTime(HOME_IDLE_MS + 1000);
    checkIdle();
    expect(useNavigation.getState().mode).toBe('grid');
  });
```

Create `src/core/components/PresenceShade.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import PresenceShade from './PresenceShade';
import { useAlerts } from '../alerts/alert-store';

vi.mock('../radar', () => ({
  useRadar: () => ({ available: true, present: false, lastPresentAt: new Date(Date.now() - 3_600_000).toISOString() }),
}));
vi.mock('../device-config', () => ({
  useDeviceConfig: () => ({ settings: { presence: { enabled: true, absentAfterMin: 1 } } }),
}));

afterEach(() => {
  cleanup();
  useAlerts.setState({ scheduled: [], ringing: null });
});

describe('PresenceShade', () => {
  it('shades an empty room, and steps aside while an alert rings', () => {
    const { container } = render(<PresenceShade />);
    expect((container.firstChild as HTMLElement).className).toContain('opacity-100');
    act(() =>
      useAlerts.setState({
        ringing: { id: 'r', appId: 'timer', firesAt: 0, firedAt: 0, sound: false, settled: false, payload: {} },
      }),
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/core/gesture-claim.test.ts src/core/playlist-advance.test.ts src/core/hooks/useIdleReturn.test.ts src/core/components/PresenceShade.test.tsx`
Expected: FAIL: `isClaimedTarget` and `shouldAdvance` are not exported; the idle test sees the grid dismissed; the shade test still finds the div while ringing.

- [ ] **Step 3: Implement**

In `src/core/gesture-zones.ts`, append:

```ts
/** True when a drag starts inside an element that claims the gesture for
 *  itself (Timer's dial band, later Alarm's ring dial). The global swipe
 *  grammar stands down for that whole gesture. */
export function isClaimedTarget(target: EventTarget | null): boolean {
  return (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    target.closest('[data-gesture="claim"]') !== null
  );
}
```

In `src/core/hooks/useGestures.ts`:
- change the gesture-zones import to `import { classifyTouchStart, isClaimedTarget } from '../gesture-zones';` and add `import { isAlertRinging } from '../alerts/alert-store';`
- below `const zoneRef = useRef<TouchZone>('inner');` add:

```ts
  // A drag that starts on a claiming element, or while an alert rings, belongs
  // to that element or to the alert: decided at start, honoured until the end.
  const claimedRef = useRef(false);
```

- replace the `onDragStart` handler with:

```ts
      onDragStart: ({ xy: [x, y], event }) => {
        claimedRef.current = isClaimedTarget(event.target) || isAlertRinging();
        zoneRef.current = classifyTouchStart(x, y, window.innerWidth, window.innerHeight);
      },
```

- make the first line of the `onDrag` handler body `if (claimedRef.current) return;`
- at the top of the `onDragEnd` handler body, before `const nav = ...`, add:

```ts
        const claimed = claimedRef.current || isAlertRinging();
        claimedRef.current = false;
        if (claimed) {
          zoneRef.current = 'inner';
          return;
        }
```

- change the first line of `onPinch` to `if (pinchFired.current || isAlertRinging()) return;`

In `src/core/playlist.ts`, add `import { isAlertRinging } from './alerts/alert-store';`, add above `usePlaylistAutoRotate`:

```ts
/** Advance only once the post-gesture cooldown has passed, and never while an
 *  alert holds the screen. */
export function shouldAdvance(now: number, lastGestureMs: number, ringing: boolean): boolean {
  return !ringing && now - lastGestureMs >= GESTURE_PAUSE_MS;
}
```

and replace the body of `tick` with:

```ts
    const tick = () => {
      if (!shouldAdvance(Date.now(), useNavigation.getState().lastGestureMs, isAlertRinging())) return;
      goto((positionRef.current + 1) % items.length);
    };
```

In `src/core/hooks/useIdleReturn.ts`, add `import { isAlertRinging } from '../alerts/alert-store';` and make the first line of `checkIdle`'s body:

```ts
  if (isAlertRinging()) return; // the alert owns the screen until dismissed
```

In `src/core/components/PresenceShade.tsx`, add `import { useAlerts } from '../alerts/alert-store';`, add with the other hooks at the top of the component:

```ts
  const alertRinging = useAlerts((s) => s.ringing !== null);
```

and directly before the final `return (`:

```ts
  // An alert must be seen; the shade steps aside until it is dismissed.
  if (alertRinging) return null;
```

- [ ] **Step 4: Run the tests and the suite**

Run: `npx vitest run src/core && npx vitest run`
Expected: all pass, whole suite green. Then `npx eslint src/core src/App.tsx` clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/gesture-zones.ts src/core/gesture-claim.test.ts src/core/hooks/useGestures.ts src/core/playlist.ts src/core/playlist-advance.test.ts src/core/hooks/useIdleReturn.ts src/core/hooks/useIdleReturn.test.ts src/core/components/PresenceShade.tsx src/core/components/PresenceShade.test.tsx
git commit -m "feat(alerts): gestures, playlist, idle-return and presence shade stand down while ringing

Also lets an element claim its own drags (data-gesture=\"claim\").

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Scaffold Timer, its schema, the Focus rename, and the docs-drift docs

**Files:**
- Created by `npm run new:app -- timer`: `src/apps/timer/index.ts`, `src/apps/timer/TimerApp.tsx`, `src/apps/timer/timer.todo.test.ts`, `src/shared/schemas/app.timer.ts`; edits to `src/apps/index.ts`, `src/shared/capabilities.ts`, `src/shared/app-capabilities.ts`, `src/shared/schema-registry.ts`
- Modify: `src/shared/schemas/app.timer.ts`, `src/apps/timer/index.ts`, `src/shared/app-capabilities.ts`, `src/apps/time-tracking/index.ts`, `src/admin/lib/app-names.ts`, `README.md`, `directive/foundation.md`, `docs/architecture.md`
- Regenerate: `src/shared/schemas.snapshot.json`

**Interfaces:**
- Produces: `TIMER_PRESET_MINUTES`, `timerAppSchema`, `timerAppMeta`, `type TimerAppConfig = { presets: Array<'1'|'2'|'3'|'5'|'10'|'15'|'20'|'25'|'30'|'45'|'60'>; sound: boolean }`.

- [ ] **Step 1: Scaffold**

Run: `npm run new:app -- timer`

- [ ] **Step 2: Write the schema**

Replace all of `src/shared/schemas/app.timer.ts` with:

```ts
import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Minute values offered as presets. Strings because the admin's ordered
// multi-select renders enums; it has no number-list editor.
export const TIMER_PRESET_MINUTES = ['1', '2', '3', '5', '10', '15', '20', '25', '30', '45', '60'] as const;

export const timerAppSchema = z.object({
  presets: z.array(z.enum(TIMER_PRESET_MINUTES)).max(4).default(['1', '3', '5', '10']),
  sound: z.boolean().default(true),
});

export const timerAppMeta: FieldMetaMap = {
  presets: { label: 'Presets', description: 'Up to four, in the order they appear on the clock' },
  sound: {
    label: 'Sound when done',
    description: 'Plays on clocks with a speaker (Fast). Others pulse silently.',
  },
};

export type TimerAppConfig = z.infer<typeof timerAppSchema>;
```

- [ ] **Step 3: Registration, capability row, rename**

Replace all of `src/apps/timer/index.ts` with (the alert view registration arrives in Task 8):

```ts
import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'timer',
    name: 'Timer',
    icon: '\u{23F2}',
    description: 'Timer with a dial and presets',
    category: 'utility',
  },
  component: lazy(() => import('./TimerApp')),
});
```

In `src/shared/app-capabilities.ts`, replace the scaffolded `'timer': [], // SCAFFOLD-TODO ...` line with (it becomes `['ticks']` in Task 8, when the interval exists; the capability test holds the row to the code):

```ts
  timer: [],
```

In `src/apps/time-tracking/index.ts`, change `name: 'Timer',` to `name: 'Focus',`.
In `src/admin/lib/app-names.ts`, change `'time-tracking': 'Timer',` to `'time-tracking': 'Focus',` and add directly after it `  timer: 'Timer',`.

- [ ] **Step 4: Docs-drift docs**

In `README.md` "Built-in apps", add directly after the `time-tracking` line:

```md
- `timer` — a timer you set with a dial or a preset; it rings over any app when it runs out
```

In `directive/foundation.md` change `15 apps registered` to `16 apps registered`; in `docs/architecture.md` change `15 apps registered today` to `16 apps registered today`.

- [ ] **Step 5: Snapshot and suite**

Run: `npm run snapshot:schemas && npx vitest run`
Expected: the snapshot writes. The only failures are `src/apps/timer/timer.todo.test.ts` (scaffold not implemented), `scripts/lib/health-report.test.ts` and `scripts/lib/analyze.test.ts` (generated docs stale until Task 9). Anything else failing is a real problem: stop.

- [ ] **Step 6: Commit**

```bash
git add src/apps/timer src/apps/index.ts src/shared/capabilities.ts src/shared/app-capabilities.ts src/shared/schema-registry.ts src/shared/schemas/app.timer.ts src/shared/schemas.snapshot.json src/apps/time-tracking/index.ts src/admin/lib/app-names.ts README.md directive/foundation.md docs/architecture.md
git commit -m "feat(timer): scaffold the app and app.timer; time-tracking is now Focus

docs-drift pins README, foundation and architecture to the registry.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Timer store, dial maths and formatting

**Files:**
- Create: `src/apps/timer/format.ts`, `src/apps/timer/dial.ts`, `src/apps/timer/timer-store.ts`
- Test: `src/apps/timer/format.test.ts`, `src/apps/timer/dial.test.ts`, `src/apps/timer/timer-store.test.ts`

**Interfaces:**
- Consumes: `createAlertStore`, `useAlerts`, `AlertState` (Task 1); `RING_FRACTION` from `src/core/gesture-zones.ts`.
- Produces:
  - `formatMMSS(ms): string` ("05:00"), `formatMinutes(ms): string` ("5:00"), `formatClock(epochMs): string` ("12:41").
  - `MIN_MS = 30_000`, `MAX_MS = 3_600_000`, `STEP_MS = 30_000`, `BAND_INNER_FRACTION = 0.6`, `snapClamp(ms)`, `inBand(x, y, width, height)`, `bandCircle(): { r: number; strokeWidth: number }` (1000-unit space), `angleFrom12(x, y, cx, cy)`, `unwrapDelta(fromDeg, toDeg)`, `degreesToMs(deg)`, `msToDegrees(ms)`.
  - `type TimerState`, `TIMER_ALERT_ID = 'timer'`, `TIMER_STORAGE_KEY`, `createTimerStore(storage, alerts)`, `useTimer` with `state` and actions `setDuration(ms)`, `start(sound, now?)`, `pause(now?)`, `resume(sound, now?)`, `reset()`, `finish()`, `reconcile(now?)`.

- [ ] **Step 1: Write the failing tests**

Create `src/apps/timer/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatClock, formatMinutes, formatMMSS } from './format';

describe('format', () => {
  it('formats a readout, rounding up partial seconds', () => {
    expect(formatMMSS(300_000)).toBe('05:00');
    expect(formatMMSS(539_001)).toBe('09:00');
    expect(formatMMSS(539_000)).toBe('08:59');
    expect(formatMMSS(3_600_000)).toBe('60:00');
    expect(formatMMSS(-5)).toBe('00:00');
  });
  it('formats a caption duration', () => {
    expect(formatMinutes(300_000)).toBe('5:00');
    expect(formatMinutes(90_000)).toBe('1:30');
  });
  it('formats a local wall-clock time', () => {
    expect(formatClock(new Date(2026, 9, 2, 9, 5).getTime())).toBe('09:05');
    expect(formatClock(new Date(2026, 9, 2, 12, 41).getTime())).toBe('12:41');
  });
});
```

Create `src/apps/timer/dial.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RING_FRACTION } from '../../core/gesture-zones';
import {
  angleFrom12, bandCircle, degreesToMs, inBand, MAX_MS, MIN_MS, msToDegrees, snapClamp, unwrapDelta,
} from './dial';

describe('dial', () => {
  it('snaps to 30 s and clamps to 0:30 … 60:00', () => {
    expect(snapClamp(100_000)).toBe(90_000);
    expect(snapClamp(106_000)).toBe(120_000);
    expect(snapClamp(0)).toBe(MIN_MS);
    expect(snapClamp(99 * 60_000)).toBe(MAX_MS);
  });
  it('classifies the band: 60% of the radius to the arc ring', () => {
    const W = 1000, H = 1000, R = 500;
    expect(inBand(500, 500 - R * 0.59, W, H)).toBe(false);
    expect(inBand(500, 500 - R * 0.61, W, H)).toBe(true);
    expect(inBand(500, 500 - R * (1 - RING_FRACTION) + 1, W, H)).toBe(true);
    expect(inBand(500, 500 - R * (1 - RING_FRACTION) - 1, W, H)).toBe(false);
  });
  it('draws the claim circle exactly over the band', () => {
    const { r, strokeWidth } = bandCircle();
    expect(r - strokeWidth / 2).toBeCloseTo(300, 6);
    expect(r + strokeWidth / 2).toBeCloseTo(500 * (1 - RING_FRACTION), 6);
  });
  it('measures angles clockwise from 12', () => {
    expect(angleFrom12(0, -1, 0, 0)).toBeCloseTo(0);
    expect(angleFrom12(1, 0, 0, 0)).toBeCloseTo(90);
    expect(angleFrom12(0, 1, 0, 0)).toBeCloseTo(180);
    expect(angleFrom12(-1, 0, 0, 0)).toBeCloseTo(270);
  });
  it('unwraps across 12 so the drag never jumps', () => {
    expect(unwrapDelta(350, 10)).toBe(20);
    expect(unwrapDelta(10, 350)).toBe(-20);
    expect(unwrapDelta(90, 120)).toBe(30);
  });
  it('maps one revolution to 60 minutes', () => {
    expect(degreesToMs(360)).toBe(MAX_MS);
    expect(degreesToMs(30)).toBe(5 * 60_000);
    expect(msToDegrees(15 * 60_000)).toBe(90);
  });
});
```

Create `src/apps/timer/timer-store.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createAlertStore } from '../../core/alerts/alert-store';
import { createTimerStore, TIMER_ALERT_ID, TIMER_STORAGE_KEY } from './timer-store';

function memory() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

function setup(storage = memory()) {
  const alerts = createAlertStore(null);
  const timer = createTimerStore(storage, alerts);
  return { alerts, timer, storage };
}

describe('timer store', () => {
  it('starts idle with no duration, and sets a snapped, clamped one', () => {
    const { timer } = setup();
    expect(timer.getState().state).toEqual({ status: 'idle', durationMs: 0 });
    timer.getState().setDuration(100_000);
    expect(timer.getState().state).toEqual({ status: 'idle', durationMs: 90_000 });
  });

  it('start schedules the core alert; pause cancels it; resume reschedules', () => {
    const { timer, alerts } = setup();
    timer.getState().setDuration(300_000);
    timer.getState().start(true, 1_000);
    expect(timer.getState().state).toEqual({ status: 'running', durationMs: 300_000, endsAt: 301_000 });
    expect(alerts.getState().scheduled).toEqual([
      { id: TIMER_ALERT_ID, appId: 'timer', firesAt: 301_000, sound: true, payload: { durationMs: 300_000 } },
    ]);
    timer.getState().pause(61_000);
    expect(timer.getState().state).toEqual({ status: 'paused', durationMs: 300_000, remainingMs: 240_000 });
    expect(alerts.getState().scheduled).toEqual([]);
    timer.getState().resume(false, 100_000);
    expect(timer.getState().state).toEqual({ status: 'running', durationMs: 300_000, endsAt: 340_000 });
    expect(alerts.getState().scheduled[0]).toMatchObject({ firesAt: 340_000, sound: false });
  });

  it('does not start without a duration, and ignores setDuration while running', () => {
    const { timer, alerts } = setup();
    timer.getState().start(true, 0);
    expect(timer.getState().state.status).toBe('idle');
    expect(alerts.getState().scheduled).toEqual([]);
    timer.getState().setDuration(60_000);
    timer.getState().start(true, 0);
    timer.getState().setDuration(120_000);
    expect(timer.getState().state).toMatchObject({ status: 'running', durationMs: 60_000 });
  });

  it('reset cancels and keeps the duration; finish returns to idle', () => {
    const { timer, alerts } = setup();
    timer.getState().setDuration(60_000);
    timer.getState().start(true, 0);
    timer.getState().reset();
    expect(timer.getState().state).toEqual({ status: 'idle', durationMs: 60_000 });
    expect(alerts.getState().scheduled).toEqual([]);
    timer.getState().start(true, 0);
    timer.getState().finish();
    expect(timer.getState().state).toEqual({ status: 'idle', durationMs: 60_000 });
  });

  it('rehydrates after a reload', () => {
    const storage = memory();
    const first = setup(storage);
    first.timer.getState().setDuration(120_000);
    first.timer.getState().start(true, Date.now());
    const alertsAfter = createAlertStore(null);
    alertsAfter.getState().schedule(first.alerts.getState().scheduled[0]);
    const second = createTimerStore(storage, alertsAfter);
    expect(second.getState().state).toMatchObject({ status: 'running', durationMs: 120_000 });
  });

  it('reconciles a past-due running timer whose alert is gone', () => {
    const storage = memory();
    storage.data.set(TIMER_STORAGE_KEY, JSON.stringify({ status: 'running', durationMs: 60_000, endsAt: 1_000 }));
    const { timer } = setup(storage);
    expect(timer.getState().state).toEqual({ status: 'idle', durationMs: 60_000 });
  });

  it('keeps a past-due running timer while its alert is still scheduled or ringing', () => {
    const { timer, alerts } = setup();
    timer.getState().setDuration(60_000);
    timer.getState().start(true, 0);
    timer.getState().reconcile(120_000);
    expect(timer.getState().state.status).toBe('running');
    alerts.getState().fire(TIMER_ALERT_ID, 60_000);
    timer.getState().reconcile(120_000);
    expect(timer.getState().state.status).toBe('running');
  });

  it('loads idle from corrupt storage', () => {
    const storage = memory();
    storage.data.set(TIMER_STORAGE_KEY, '{nope');
    expect(setup(storage).timer.getState().state).toEqual({ status: 'idle', durationMs: 0 });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/apps/timer/format.test.ts src/apps/timer/dial.test.ts src/apps/timer/timer-store.test.ts`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Implement**

Create `src/apps/timer/format.ts`:

```ts
const pad = (n: number) => String(n).padStart(2, '0');

/** The readout. Partial seconds round up, so it reads 00:00 only at the end. */
export function formatMMSS(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** A duration in a caption: "5:00", "1:30". */
export function formatMinutes(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** Local wall-clock time for "Done at 12:41". */
export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

Create `src/apps/timer/dial.ts`:

```ts
// Dial maths for setting the timer. One revolution is 60 minutes. The band
// that claims drags runs from 60% of the radius to the inner edge of the
// arc-zone ring, so the outer arcs keep their grammar and a swipe nearer the
// centre still switches apps.
import { RING_FRACTION } from '../../core/gesture-zones';

export const MIN_MS = 30_000;
export const MAX_MS = 60 * 60_000;
export const STEP_MS = 30_000;
export const BAND_INNER_FRACTION = 0.6;

export function snapClamp(ms: number): number {
  const snapped = Math.round(ms / STEP_MS) * STEP_MS;
  return Math.min(MAX_MS, Math.max(MIN_MS, snapped));
}

export function inBand(x: number, y: number, width: number, height: number): boolean {
  const r = Math.min(width, height) / 2;
  const d = Math.hypot(x - width / 2, y - height / 2);
  return d >= r * BAND_INNER_FRACTION && d <= r * (1 - RING_FRACTION);
}

/** The band as an SVG stroke in the 1000-unit disc: r 367.6, width 135.2. */
export function bandCircle(): { r: number; strokeWidth: number } {
  const inner = 500 * BAND_INNER_FRACTION;
  const outer = 500 * (1 - RING_FRACTION);
  return { r: (inner + outer) / 2, strokeWidth: outer - inner };
}

/** Degrees clockwise from 12 o'clock, in [0, 360). */
export function angleFrom12(x: number, y: number, cx: number, cy: number): number {
  return ((Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI + 360) % 360;
}

/** The short way round, so crossing 12 is ±a few degrees, never ±360. */
export function unwrapDelta(fromDeg: number, toDeg: number): number {
  let d = toDeg - fromDeg;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function degreesToMs(deg: number): number {
  return (deg / 360) * MAX_MS;
}

export function msToDegrees(ms: number): number {
  return (ms / MAX_MS) * 360;
}
```

Create `src/apps/timer/timer-store.ts`:

```ts
// The one timer on this clock. Module scope because SwipeContainer unmounts
// the app on swipe-away; persisted so a running timer survives a reload. The
// alert itself lives in the core alert store, which rings it from anywhere.
import { create } from 'zustand';
import { z } from 'zod';
import { useAlerts, type AlertState } from '../../core/alerts/alert-store';
import { snapClamp } from './dial';

export type TimerState =
  | { status: 'idle'; durationMs: number }
  | { status: 'running'; durationMs: number; endsAt: number }
  | { status: 'paused'; durationMs: number; remainingMs: number };

interface TimerStore {
  state: TimerState;
  setDuration: (ms: number) => void;
  start: (sound: boolean, now?: number) => void;
  pause: (now?: number) => void;
  resume: (sound: boolean, now?: number) => void;
  reset: () => void;
  finish: () => void;
  reconcile: (now?: number) => void;
}

export const TIMER_ALERT_ID = 'timer';
export const TIMER_STORAGE_KEY = 'superclock:app:timer:v1';

const stateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('idle'), durationMs: z.number() }),
  z.object({ status: z.literal('running'), durationMs: z.number(), endsAt: z.number() }),
  z.object({ status: z.literal('paused'), durationMs: z.number(), remainingMs: z.number() }),
]);

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function load(storage: StorageLike | null): TimerState {
  const fresh: TimerState = { status: 'idle', durationMs: 0 };
  if (!storage) return fresh;
  try {
    const raw = storage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fresh;
  } catch {
    return fresh;
  }
}

export function createTimerStore(storage: StorageLike | null, alerts: { getState(): AlertState }) {
  const scheduleAlert = (firesAt: number, durationMs: number, sound: boolean) =>
    alerts.getState().schedule({ id: TIMER_ALERT_ID, appId: 'timer', firesAt, sound, payload: { durationMs } });

  const store = create<TimerStore>()((set, get) => ({
    state: load(storage),
    setDuration: (ms) => {
      if (get().state.status !== 'idle') return;
      set({ state: { status: 'idle', durationMs: snapClamp(ms) } });
    },
    start: (sound, now = Date.now()) => {
      const s = get().state;
      if (s.status !== 'idle' || s.durationMs <= 0) return;
      const endsAt = now + s.durationMs;
      scheduleAlert(endsAt, s.durationMs, sound);
      set({ state: { status: 'running', durationMs: s.durationMs, endsAt } });
    },
    pause: (now = Date.now()) => {
      const s = get().state;
      if (s.status !== 'running') return;
      alerts.getState().cancel(TIMER_ALERT_ID);
      set({ state: { status: 'paused', durationMs: s.durationMs, remainingMs: Math.max(0, s.endsAt - now) } });
    },
    resume: (sound, now = Date.now()) => {
      const s = get().state;
      if (s.status !== 'paused') return;
      const endsAt = now + s.remainingMs;
      scheduleAlert(endsAt, s.durationMs, sound);
      set({ state: { status: 'running', durationMs: s.durationMs, endsAt } });
    },
    reset: () => {
      const s = get().state;
      if (s.status === 'idle') return;
      alerts.getState().cancel(TIMER_ALERT_ID);
      set({ state: { status: 'idle', durationMs: s.durationMs } });
    },
    finish: () => set({ state: { status: 'idle', durationMs: get().state.durationMs } }),
    reconcile: (now = Date.now()) => {
      const s = get().state;
      if (s.status !== 'running' || s.endsAt > now) return;
      const { scheduled, ringing } = alerts.getState();
      const live = scheduled.some((a) => a.id === TIMER_ALERT_ID) || ringing?.id === TIMER_ALERT_ID;
      // An alert cleared through the layer's fallback view never calls finish().
      if (!live) set({ state: { status: 'idle', durationMs: s.durationMs } });
    },
  }));

  store.subscribe(({ state }) => {
    if (!storage) return;
    try {
      storage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Full or blocked storage: the timer still runs this session.
    }
  });
  store.getState().reconcile();
  return store;
}

const defaultStorage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

export const useTimer = createTimerStore(defaultStorage, useAlerts);
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run src/apps/timer/format.test.ts src/apps/timer/dial.test.ts src/apps/timer/timer-store.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/apps/timer/format.ts src/apps/timer/format.test.ts src/apps/timer/dial.ts src/apps/timer/dial.test.ts src/apps/timer/timer-store.ts src/apps/timer/timer-store.test.ts
git commit -m "feat(timer): persisted timer store, dial maths, formatting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The Timer screens, its alert view, tile and names

**Files:**
- Modify: `src/apps/timer/TimerApp.tsx` (replace the scaffold), `src/apps/timer/index.ts`, `src/shared/app-capabilities.ts`, `src/index.css`, `src/shared/app-icons.ts`, `src/core/components/AppGrid.tsx`
- Create: `src/apps/timer/TimerDial.tsx`, `src/apps/timer/TimerAlert.tsx`, `public/timer-thumb.svg`
- Delete: `src/apps/timer/timer.todo.test.ts`
- Test: `src/apps/timer/TimerApp.test.tsx`, `src/apps/timer/TimerAlert.test.tsx`

**Interfaces:**
- Consumes: `useTimer`, `TIMER_ALERT_ID` (Task 7); `formatMMSS`, `formatMinutes`, `formatClock` (Task 7); `bandCircle`, `angleFrom12`, `unwrapDelta`, `degreesToMs`, `msToDegrees`, `snapClamp` (Task 7); `timerAppSchema` (Task 6); `registerAlertView`, `AlertViewProps` (Task 4); `useAlerts` (Task 1).
- Produces: default exports `TimerApp({ isActive, config }: AppProps)`, `TimerDial({ durationMs, onChange })`, `TimerAlert(props: AlertViewProps)`.

- [ ] **Step 1: Write the failing tests**

Create `src/apps/timer/TimerApp.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import TimerApp from './TimerApp';
import { useTimer } from './timer-store';
import { useAlerts } from '../../core/alerts/alert-store';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 2, 9, 0, 0));
  useAlerts.setState({ scheduled: [], ringing: null });
  useTimer.setState({ state: { status: 'idle', durationMs: 0 } });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const config = { presets: ['5', '10'], sound: true };

describe('TimerApp', () => {
  it('seeds the first preset on first run and lists the presets', () => {
    render(<TimerApp isActive config={config} />);
    expect(screen.getByText('05:00')).toBeTruthy();
    expect(screen.getByText('5 min').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('10 min').getAttribute('aria-pressed')).toBe('false');
  });

  it('a preset sets the duration; tapping the readout starts with the configured sound', () => {
    render(<TimerApp isActive config={config} />);
    fireEvent.click(screen.getByText('10 min'));
    expect(screen.getByText('10:00')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Start timer'));
    expect(useTimer.getState().state.status).toBe('running');
    expect(useAlerts.getState().scheduled[0]).toMatchObject({ id: 'timer', sound: true });
  });

  it('counts down while active, with a caption of the full duration', () => {
    useTimer.setState({ state: { status: 'running', durationMs: 600_000, endsAt: Date.now() + 600_000 } });
    render(<TimerApp isActive config={config} />);
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('of 10:00')).toBeTruthy();
    act(() => vi.advanceTimersByTime(61_000));
    expect(screen.getByText('08:59')).toBeTruthy();
  });

  it('tap pauses; tap again resumes; long-press resets', () => {
    useTimer.setState({ state: { status: 'running', durationMs: 600_000, endsAt: Date.now() + 600_000 } });
    render(<TimerApp isActive config={config} />);
    const press = () => screen.getByRole('button', { name: /timer/i });
    fireEvent.pointerDown(press());
    fireEvent.pointerUp(press());
    expect(useTimer.getState().state.status).toBe('paused');
    expect(screen.getByText('Paused')).toBeTruthy();
    fireEvent.pointerDown(press());
    fireEvent.pointerUp(press());
    expect(useTimer.getState().state.status).toBe('running');
    fireEvent.pointerDown(press());
    act(() => vi.advanceTimersByTime(600));
    expect(useTimer.getState().state.status).toBe('idle');
  });

  it('runs no interval while inactive', () => {
    useTimer.setState({ state: { status: 'running', durationMs: 600_000, endsAt: Date.now() + 600_000 } });
    render(<TimerApp isActive={false} config={config} />);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('carries the dial band that claims its own drags', () => {
    const { container } = render(<TimerApp isActive config={config} />);
    expect(container.querySelector('[data-gesture="claim"]')).toBeTruthy();
  });
});
```

Create `src/apps/timer/TimerAlert.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TimerAlert from './TimerAlert';
import { useTimer } from './timer-store';
import type { RingingAlert } from '../../core/alerts/alert-store';

afterEach(cleanup);

const alert: RingingAlert = {
  id: 'timer', appId: 'timer', firesAt: 0, firedAt: new Date(2026, 9, 2, 12, 41).getTime(),
  sound: true, settled: false, payload: { durationMs: 300_000 },
};

describe('TimerAlert', () => {
  it('pulses "00:00 · Time\'s up" while ringing; a tap finishes the timer and dismisses', () => {
    useTimer.setState({ state: { status: 'running', durationMs: 300_000, endsAt: 0 } });
    const dismiss = vi.fn();
    render(<TimerAlert alert={alert} phase="ringing" dismiss={dismiss} />);
    expect(screen.getByText('00:00')).toBeTruthy();
    expect(screen.getByText("Time's up")).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Dismiss timer' });
    expect(button.className).toContain('alert-pulse');
    fireEvent.click(button);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(useTimer.getState().state).toEqual({ status: 'idle', durationMs: 300_000 });
  });

  it('settles into a still "Done at" screen', () => {
    render(<TimerAlert alert={{ ...alert, settled: true }} phase="settled" dismiss={() => {}} />);
    expect(screen.getByText('Done at')).toBeTruthy();
    expect(screen.getByText('12:41')).toBeTruthy();
    expect(screen.getByText('Tap to clear')).toBeTruthy();
    expect(screen.getByRole('button').className).not.toContain('alert-pulse');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/apps/timer/TimerApp.test.tsx src/apps/timer/TimerAlert.test.tsx`
Expected: FAIL: the scaffold renders "Timer scaffold" (`Unable to find an element with the text: 05:00`) and `./TimerAlert` does not resolve.

- [ ] **Step 3: Implement the dial**

Create `src/apps/timer/TimerDial.tsx`:

```tsx
import { useRef } from 'react';
import { angleFrom12, bandCircle, degreesToMs, msToDegrees, snapClamp, unwrapDelta } from './dial';

/** The invisible band that sets the duration. Its stroke is the hit area
 *  (pointer-events="stroke"), so only touches that start in the band claim
 *  the drag; the global swipe grammar skips anything marked
 *  data-gesture="claim". Dragging is relative and cumulative, so crossing 12
 *  never jumps and one revolution is the full 60 minutes. */
export default function TimerDial({ durationMs, onChange }: { durationMs: number; onChange: (ms: number) => void }) {
  const drag = useRef<{ lastDeg: number; totalDeg: number } | null>(null);
  const { r, strokeWidth } = bandCircle();

  const angleOf = (e: React.PointerEvent<SVGCircleElement>) => {
    const box = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    return angleFrom12(e.clientX, e.clientY, box.left + box.width / 2, box.top + box.height / 2);
  };

  return (
    <svg viewBox="0 0 1000 1000" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <circle
        cx="500"
        cy="500"
        r={r}
        strokeWidth={strokeWidth}
        pointerEvents="stroke"
        data-gesture="claim"
        className="touch-none fill-none stroke-transparent"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { lastDeg: angleOf(e), totalDeg: msToDegrees(durationMs) };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const deg = angleOf(e);
          d.totalDeg = Math.min(360, Math.max(0, d.totalDeg + unwrapDelta(d.lastDeg, deg)));
          d.lastDeg = deg;
          onChange(snapClamp(degreesToMs(d.totalDeg)));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
    </svg>
  );
}
```

- [ ] **Step 4: Implement the screens**

Replace all of `src/apps/timer/TimerApp.tsx` with:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../../core/types';
import { timerAppSchema } from '../../shared/schemas/app.timer';
import { useTimer } from './timer-store';
import { formatMMSS, formatMinutes } from './format';
import { MAX_MS } from './dial';
import TimerDial from './TimerDial';

// Ring geometry in the 1000-unit disc. r 380 keeps the visible ring inside the
// dial band (300 to 435), so touching it never starts an arc gesture.
const R = 380;
const C = 2 * Math.PI * R;
const LONG_PRESS_MS = 600;

type Tone = 'ink' | 'accent' | 'muted';
const TONE: Record<Tone, string> = {
  ink: 'stroke-(--face-ink)',
  accent: 'stroke-(--color-accent)',
  muted: 'stroke-(--face-ink-muted)',
};

/** fraction of the circle drawn, ending at 12; `draining` starts it later so
 *  the empty part grows clockwise from 12 as time runs out. */
function Ring({ fraction, tone, draining }: { fraction: number; tone: Tone; draining: boolean }) {
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <circle cx="500" cy="500" r={R} strokeWidth="26" className="fill-none stroke-(--face-ghost)" />
      <circle
        cx="500"
        cy="500"
        r={R}
        strokeWidth="26"
        strokeDasharray={`${C * f} ${C}`}
        strokeDashoffset={draining ? -C * (1 - f) : 0}
        transform="rotate(-90 500 500)"
        className={`fill-none ${TONE[tone]} ${draining ? 'transition-[stroke-dasharray,stroke-dashoffset] duration-1000 ease-linear' : ''}`}
      />
    </svg>
  );
}

/** Tap vs long-press on one target. The timeout is a one-shot, not a tick. */
function usePress(onTap: () => void, onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: () => {
      longFired.current = false;
      clear();
      timer.current = setTimeout(() => {
        longFired.current = true;
        timer.current = null;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerUp: () => {
      const wasPending = timer.current !== null;
      clear();
      if (wasPending && !longFired.current) onTap();
    },
    onPointerLeave: clear,
  };
}

/** Timer: set with the dial or a preset, start, swipe away; the core alert
 *  layer rings it from wherever the clock is when it runs out. */
export default function TimerApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = timerAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : timerAppSchema.parse({});
  }, [config]);
  const presets = useMemo(() => cfg.presets.map(Number), [cfg.presets]);
  const firstPresetMs = (presets[0] ?? 5) * 60_000;

  const state = useTimer((s) => s.state);
  const actions = useTimer.getState();

  // First run: the first preset. A store write from an effect, not a setState.
  useEffect(() => {
    if (state.status === 'idle' && state.durationMs === 0) actions.setDuration(firstPresetMs);
  }, [state, firstPresetMs, actions]);

  // A running timer whose alert was cleared some other way returns to idle.
  useEffect(() => {
    actions.reconcile();
  }, [state, actions]);

  const [now, setNow] = useState(() => Date.now());
  const [wasActive, setWasActive] = useState(isActive);
  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) setNow(Date.now()); // catch up after being swiped away
  }

  // The per-second readout: only while active and running (KIO-1).
  useEffect(() => {
    if (!isActive || state.status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive, state.status]);

  const start = () => {
    actions.start(cfg.sound);
    setNow(Date.now());
  };
  const runningPress = usePress(
    () => actions.pause(),
    () => actions.reset(),
  );
  const pausedPress = usePress(
    () => {
      actions.resume(cfg.sound);
      setNow(Date.now());
    },
    () => actions.reset(),
  );

  if (state.status === 'running' || state.status === 'paused') {
    const running = state.status === 'running';
    const remaining = running ? Math.max(0, state.endsAt - now) : state.remainingMs;
    const fraction = state.durationMs > 0 ? remaining / state.durationMs : 0;
    const press = running ? runningPress : pausedPress;
    const ink = running ? 'text-(--face-ink)' : 'text-(--face-ink-muted)';
    return (
      <div className="theme-fade relative flex h-full w-full items-center justify-center bg-(--face-bg)">
        <Ring fraction={fraction} tone={running ? 'accent' : 'muted'} draining />
        <button
          type="button"
          aria-label={running ? 'Pause timer' : 'Resume timer'}
          className="relative flex flex-col items-center text-center"
          {...press}
        >
          <span className={`theme-fade text-[17vmin] leading-none tabular-nums ${ink}`}>{formatMMSS(remaining)}</span>
          <span className="theme-fade mt-[1.5vmin] text-[2.2vmin] text-(--face-ink-muted)">
            {running ? `of ${formatMinutes(state.durationMs)}` : 'Paused'}
          </span>
        </button>
      </div>
    );
  }

  const durationMs = state.durationMs || firstPresetMs;
  return (
    <div className="theme-fade relative flex h-full w-full items-center justify-center bg-(--face-bg)">
      <Ring fraction={durationMs / MAX_MS} tone="ink" draining={false} />
      <TimerDial durationMs={durationMs} onChange={actions.setDuration} />
      <div className="relative flex flex-col items-center text-center">
        <p className="theme-fade text-[2.2vmin] text-(--face-ink-muted)">Set timer</p>
        <button
          type="button"
          aria-label="Start timer"
          onClick={start}
          className="theme-fade mt-[1.5vmin] text-[17vmin] leading-none tabular-nums text-(--face-ink)"
        >
          {formatMMSS(durationMs)}
        </button>
        <div className="mt-[3vmin] flex gap-[1.5vmin]">
          {presets.map((m) => {
            const selected = durationMs === m * 60_000;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={selected}
                onClick={() => actions.setDuration(m * 60_000)}
                className={`theme-fade rounded-full border px-[2.4vmin] py-[1vmin] text-[2.6vmin] ${
                  selected
                    ? 'border-transparent bg-(--face-ink) text-(--face-bg)'
                    : 'border-(--face-ghost) text-(--face-ink)'
                }`}
              >
                {m} min
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement the alert view, its pulse, and register it**

Create `src/apps/timer/TimerAlert.tsx`:

```tsx
import type { AlertViewProps } from '../../core/alerts/views';
import { useTimer } from './timer-store';
import { formatClock } from './format';

/** Board frames 2 and 4: "00:00 · Time's up" pulsing for five minutes, then a
 *  still "Done at 12:41". A tap anywhere clears it. */
export default function TimerAlert({ alert, phase, dismiss }: AlertViewProps) {
  const clear = () => {
    useTimer.getState().finish();
    dismiss();
  };

  if (phase === 'settled') {
    return (
      <button
        type="button"
        aria-label="Clear timer"
        onClick={clear}
        className="theme-fade flex h-full w-full flex-col items-center justify-center bg-(--face-bg) text-center"
      >
        <span className="text-[2.6vmin] font-medium text-(--face-ink-muted)">Done at</span>
        <span className="mt-[1.5vmin] text-[17vmin] leading-none tabular-nums text-(--face-ink-muted)">
          {formatClock(alert.firedAt)}
        </span>
        <span className="mt-[3vmin] text-[2.2vmin] text-(--face-ink-muted)">Tap to clear</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Dismiss timer"
      onClick={clear}
      className="alert-pulse flex h-full w-full flex-col items-center justify-center text-center"
    >
      <span className="text-[17vmin] leading-none tabular-nums">00:00</span>
      <span className="mt-[3vmin] text-[2.6vmin]">Time's up</span>
    </button>
  );
}
```

In `src/index.css`, directly after the `.dissolve-in { ... }` block, add:

```css
/* The ringing alert: the face palette and its inverse, half a second each.
   One flash per second sits under the 3-per-second photosensitivity limit, it
   loops only while an alert is really ringing, and the core scheduler settles
   it after five minutes. Reduced motion holds the inverse instead. */
@keyframes alert-pulse {
  0% { background-color: var(--face-bg); color: var(--face-ink); }
  50% { background-color: var(--face-ink); color: var(--face-bg); }
}

.alert-pulse {
  animation: alert-pulse 1s step-end infinite;
}

@media (prefers-reduced-motion: reduce) {
  .alert-pulse {
    animation: none;
    background-color: var(--face-ink);
    color: var(--face-bg);
  }
}
```

Replace all of `src/apps/timer/index.ts` with:

```ts
import { lazy } from 'react';
import { registerApp } from '../../core/registry';
import { registerAlertView } from '../../core/alerts/views';

registerApp({
  metadata: {
    id: 'timer',
    name: 'Timer',
    icon: '\u{23F2}',
    description: 'Timer with a dial and presets',
    category: 'utility',
  },
  component: lazy(() => import('./TimerApp')),
});

registerAlertView('timer', lazy(() => import('./TimerAlert')));
```

In `src/shared/app-capabilities.ts`, change `  timer: [],` to:

```ts
  // The per-second readout interval, gated on isActive. The alert itself is core.
  timer: ['ticks'],
```

- [ ] **Step 6: Delete the scaffold's todo test and run the timer tests**

```bash
git rm src/apps/timer/timer.todo.test.ts
npx vitest run src/apps/timer
```

Expected: all timer tests pass.

- [ ] **Step 7: Tile, icon and grid**

Create `public/timer-thumb.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="100" fill="#101418"/>
  <circle cx="100" cy="92" r="58" fill="none" stroke="#3a3f45" stroke-width="8"/>
  <circle cx="100" cy="92" r="58" fill="none" stroke="#ff8826" stroke-width="8" stroke-dasharray="273 365" stroke-dashoffset="-92" transform="rotate(-90 100 92)"/>
  <text x="100" y="104" text-anchor="middle" font-family="Inter, sans-serif" font-size="32" font-weight="400" fill="#e8e8e8">05:00</text>
  <text x="100" y="188" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" font-weight="600" fill="#e8e8e8">Timer</text>
</svg>
```

In `src/shared/app-icons.ts`, add directly after the `'time-tracking'` line:

```ts
  timer: '/timer-thumb.svg',
```

In `src/core/components/AppGrid.tsx`, append to `appFaces` after the `countdown` entry:

```ts
  { id: 'timer',           src: '/timer-thumb.svg' },
```

and change the fifth column to:

```ts
  [appFaces[10], appFaces[11], appFaces[0], appFaces[17]], // Clock, Relax, Gym, Timer
```

- [ ] **Step 8: Run the suite**

Run: `npx vitest run`
Expected: green except `health-report.test.ts` and `analyze.test.ts` (Task 9). `app-capabilities.test.ts` must pass with `timer: ['ticks']`; `registry-contract.test.ts` must find `public/timer-thumb.svg` and the admin names `Timer` / `Focus`.

- [ ] **Step 9: Commit**

```bash
git add src/apps/timer src/shared/app-capabilities.ts src/index.css public/timer-thumb.svg src/shared/app-icons.ts src/core/components/AppGrid.tsx
git commit -m "feat(timer): set, running, paused screens, the dial band, and the ringing alert view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Generated docs and the full gate

**Files:**
- Regenerate: `docs/health.md`, `docs/analysis/declared-vs-read.md`

- [ ] **Step 1: Regenerate**

```bash
npm run report
npm run analyze -- --write
```

Expected: `docs/health.md` reads Apps (16), Schemas (29), with a `timer` row (`ticks`, `app.timer`, read: yes); declared-vs-read lists both `app.timer` fields as read.

- [ ] **Step 2: Run the local CI mirror**

Run: `./scripts/gates.sh`
Expected: lint, `check:tokens`, test, build all green; `npm run check:rules` shows no new hit under `src/core/alerts/` or `src/apps/timer/`.

- [ ] **Step 3: Commit**

```bash
git add docs/health.md docs/analysis/declared-vs-read.md
git commit -m "docs: regenerate health and declared-vs-read for Timer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Rendered verification, fastclock, agent log (controller)

No code unless a check fails; a failing check goes back to the task that owns the file.

- [ ] **Step 1: Render in the dev kiosk at 1080 × 1080**

Start the `dev` preview, front the tab, `resize_window` 1080 × 1080. Post a Timer instance to the dev server's own config (`POST /api/device/config` on localhost only), reload, and switch to it with `window.__nav.getState().switchToInstance('<id>', 'timer')` then `finishTransition()`. Measure relative to the app's own root (the hidden pane freezes swipe transforms). Check, in both palettes:
1. Set time: readout 183.6 px, chips present, ring radius 380 units (410 px) inside the band, band circle 300 to 435 units.
2. Running (start from the readout): accent ring, caption "of 5:00", readout counts down.
3. Paused: muted ring and readout, "Paused".
4. Ringing: set `useAlerts` ringing for `appId: 'timer'` directly; the layer covers the grid (open the grid first), "00:00 · Time's up", class `alert-pulse`.
5. Settled: call `useAlerts.getState().settle()`; "Done at HH:MM", no pulse.

- [ ] **Step 2: Gesture check in the browser**

With the Timer on screen, dispatch a pointer drag that starts in the band (e.g. from (540, 540 − 400) clockwise) and confirm the duration changes and `activeAppId` stays `timer`; dispatch a horizontal swipe from near the centre and confirm the app switches. While an alert rings, a swipe must not switch apps.

- [ ] **Step 3: Deploy to fastclock**

```bash
DEPLOY_ANYWAY=1 bash scripts/deploy.sh nickv2026@100.78.29.28
ssh nickv2026@100.78.29.28 'pkill -TERM chromium'
```

Confirm the health stamp, capture the panel with `grim`, and run the second-hand sweep check (smooth, no stalled frames). Adding a Timer screen and hearing the chime need Nick (token-gated device config, a real touch); once a timer rings on fastclock, confirm `grep -l RUNNING /proc/asound/card*/pcm*p/sub*/status` over SSH.

- [ ] **Step 4: Agent log**

Append a newest-first entry to `docs/agent-log.md` (changed files, verification, rulings, open items), then:

```bash
git add docs/agent-log.md
git commit -m "docs: agent-log entry for background alerts + Timer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
