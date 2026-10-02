// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import AlarmAlert from './AlarmAlert';
import { useAlerts, type RingingAlert } from '../../core/alerts/alert-store';

const config = vi.hoisted(() => ({ value: { deviceId: 'superclock-fast', instances: [] } as Record<string, unknown> }));
vi.mock('../../core/device-config', () => ({ useDeviceConfig: () => config.value }));

const T = new Date(2026, 9, 3, 7, 10).getTime();
const ringing: RingingAlert = {
  id: 'alarm:a1', appId: 'alarm', firesAt: T, firedAt: T, sound: true, bright: true, ringMs: 900_000,
  settled: false, payload: { alarmId: 'a1', time: '07:10' },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T);
  config.value = { deviceId: 'superclock-fast', instances: [] };
  useAlerts.setState({ scheduled: [], ringing, leading: null, leadHidden: false });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const press = () => screen.getByRole('button');

describe('AlarmAlert', () => {
  it('speaker clock: two rings and the copy; a tap snoozes for the configured minutes', () => {
    const { container } = render(<AlarmAlert alert={ringing} phase="ringing" dismiss={() => {}} />);
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(screen.getByText('Tap to snooze 9 min')).toBeTruthy();
    expect(screen.getByText('Hold 2 s to stop')).toBeTruthy();
    fireEvent.pointerDown(press());
    fireEvent.pointerUp(press());
    expect(useAlerts.getState().ringing).toBeNull();
    expect(useAlerts.getState().scheduled[0]).toMatchObject({ id: 'alarm:a1:snooze', firesAt: T + 9 * 60_000 });
  });

  it('a 2 s hold stops; a 1 s press does neither', () => {
    const dismiss = vi.fn();
    render(<AlarmAlert alert={ringing} phase="ringing" dismiss={dismiss} />);
    fireEvent.pointerDown(press());
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.pointerUp(press());
    expect(dismiss).not.toHaveBeenCalled();
    expect(useAlerts.getState().scheduled).toEqual([]);
    fireEvent.pointerDown(press());
    expect(press().querySelector('.origin-left')!.className).toContain('scale-x-100');
    act(() => vi.advanceTimersByTime(2000));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(useAlerts.getState().scheduled).toEqual([]);
  });

  it('silent clock: the full-screen flash and the chip, no rings', () => {
    config.value = { deviceId: 'superclock-small', instances: [] };
    const { container } = render(<AlarmAlert alert={ringing} phase="ringing" dismiss={() => {}} />);
    expect(press().className).toContain('alert-pulse');
    expect(screen.getByText('No speaker, flash only')).toBeTruthy();
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('missed: says when the next alarm is, and clears on tap', () => {
    useAlerts.setState({
      ringing: { ...ringing, settled: true },
      scheduled: [{ id: 'alarm:a1', appId: 'alarm', firesAt: new Date(2026, 9, 4, 7, 10).getTime(), sound: true, payload: {} }],
    });
    const dismiss = vi.fn();
    render(<AlarmAlert alert={{ ...ringing, settled: true }} phase="settled" dismiss={dismiss} />);
    expect(screen.getByText('Missed')).toBeTruthy();
    expect(screen.getByText('Next: tomorrow 07:10')).toBeTruthy();
    fireEvent.click(press());
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('missed with nothing else set says so', () => {
    render(<AlarmAlert alert={{ ...ringing, settled: true }} phase="settled" dismiss={() => {}} />);
    expect(screen.getByText('No other alarms')).toBeTruthy();
  });
});
