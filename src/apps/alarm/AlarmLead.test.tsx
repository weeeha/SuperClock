// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import AlarmLead from './AlarmLead';

const alert = { id: 'alarm:a1', appId: 'alarm', firesAt: 0, sound: true, payload: { alarmId: 'a1', time: '07:10' }, leadMs: 600_000 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 3, 6, 58, 30));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AlarmLead', () => {
  it('shows the time and the alarm, steps on the minute, and hides on tap', () => {
    const hide = vi.fn();
    render(<AlarmLead alert={alert} hide={hide} />);
    expect(screen.getByText('06:58')).toBeTruthy();
    expect(screen.getByText('Alarm at 07:10')).toBeTruthy();
    act(() => vi.advanceTimersByTime(31_000));
    expect(screen.getByText('06:59')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(hide).toHaveBeenCalledTimes(1);
  });
});
