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
