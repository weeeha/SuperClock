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
