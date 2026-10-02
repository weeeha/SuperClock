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
