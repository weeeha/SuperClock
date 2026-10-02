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
