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

  it('keeps the running arc anchored at 12, its end retreating as time runs out (board frame 1)', () => {
    useTimer.setState({ state: { status: 'running', durationMs: 600_000, endsAt: Date.now() + 300_000 } });
    const { container } = render(<TimerApp isActive config={config} />);
    const arc = container.querySelectorAll('circle')[1];
    const circumference = 2 * Math.PI * 380;
    expect(Number(arc.getAttribute('stroke-dasharray')!.split(' ')[0])).toBeCloseTo(circumference / 2, 3);
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBe(0);
  });

  it('carries the dial band that claims its own drags', () => {
    const { container } = render(<TimerApp isActive config={config} />);
    expect(container.querySelector('[data-gesture="claim"]')).toBeTruthy();
  });
});
