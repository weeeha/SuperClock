// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import AlarmApp from './AlarmApp';
import { useAlarms } from './alarm-store';
import { useAlerts } from '../../core/alerts/alert-store';
import { useNavigation } from '../../core/navigation';

const daily = { id: 'd1', time: '07:10', days: [0, 1, 2, 3, 4, 5, 6], enabled: true };
const weekdays = { id: 'w1', time: '06:30', days: [1, 2, 3, 4, 5], enabled: true };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 2, 22, 38, 0)); // Friday 22:38
  useAlarms.setState({ alarms: [] });
  useAlerts.setState({ scheduled: [], ringing: null, leading: null, leadHidden: false });
  useNavigation.setState({ verticalSwipeCallback: null, backCallback: null });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AlarmApp', () => {
  it('no alarms: names the creating action and opens a new alarm at 07:00, once', () => {
    render(<AlarmApp isActive />);
    expect(screen.getByText('No alarms')).toBeTruthy();
    fireEvent.click(screen.getByText('Add alarm'));
    expect(screen.getByLabelText('Switch the dial to hours').textContent).toBe('07:00');
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(7);
    fireEvent.click(screen.getByText('Done'));
    expect(useAlarms.getState().alarms).toMatchObject([{ time: '07:00', days: [], enabled: true }]);
    expect(screen.getByText('Alarms')).toBeTruthy();
  });

  it('resting: next alarm, countdown, days; the armed switch turns it off', () => {
    useAlarms.setState({ alarms: [daily] });
    render(<AlarmApp isActive />);
    expect(screen.getByText('07:10')).toBeTruthy();
    expect(screen.getByText('in 8h 32m')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Every day' })).toBeTruthy();
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(useAlarms.getState().alarms[0].enabled).toBe(false);
    expect(screen.getByText('All alarms off')).toBeTruthy();
  });

  it('turning an alarm off drops its pending snooze', () => {
    useAlarms.setState({ alarms: [daily] });
    useAlerts.getState().schedule({ id: 'alarm:d1:snooze', appId: 'alarm', firesAt: Date.now() + 60_000, sound: true, payload: { alarmId: 'd1' } });
    render(<AlarmApp isActive />);
    fireEvent.click(screen.getByRole('switch'));
    expect(useAlerts.getState().scheduled).toEqual([]);
  });

  it('swipes between resting and the list; a row switch toggles without opening edit', () => {
    useAlarms.setState({ alarms: [daily, weekdays] });
    render(<AlarmApp isActive />);
    act(() => useNavigation.getState().verticalSwipeCallback?.('up'));
    expect(screen.getByText('Alarms')).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('switch')[0]); // 06:30 sorts first
    expect(useAlarms.getState().alarms.find((a) => a.id === 'w1')?.enabled).toBe(false);
    expect(screen.queryByText('Done')).toBeNull();
    act(() => useNavigation.getState().verticalSwipeCallback?.('down'));
    expect(screen.getByText('Next alarm')).toBeTruthy();
  });

  it('edit: the readout switches the dial to hours, pills toggle, back saves', () => {
    useAlarms.setState({ alarms: [weekdays] });
    render(<AlarmApp isActive />);
    act(() => useNavigation.getState().verticalSwipeCallback?.('up'));
    fireEvent.click(screen.getByText('06:30'));
    expect(screen.getByText(/Dial sets minutes/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Switch the dial to hours'));
    expect(screen.getByText(/Dial sets hours/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Sun'));
    expect(screen.getByLabelText('Sun').getAttribute('aria-pressed')).toBe('true');
    act(() => useNavigation.getState().backCallback?.());
    expect(useAlarms.getState().alarms[0].days).toEqual([0, 1, 2, 3, 4, 5]);
    expect(screen.getByText('Alarms')).toBeTruthy();
  });

  it('delete removes the alarm and its snooze', () => {
    useAlarms.setState({ alarms: [weekdays] });
    useAlerts.getState().schedule({ id: 'alarm:w1:snooze', appId: 'alarm', firesAt: Date.now() + 60_000, sound: true, payload: { alarmId: 'w1' } });
    render(<AlarmApp isActive />);
    act(() => useNavigation.getState().verticalSwipeCallback?.('up'));
    fireEvent.click(screen.getByText('06:30'));
    fireEvent.click(screen.getByText('Delete'));
    expect(useAlarms.getState().alarms).toEqual([]);
    expect(useAlerts.getState().scheduled).toEqual([]);
  });

  it('carries the dial band in edit, and runs no interval while inactive', () => {
    const { container, unmount } = render(<AlarmApp isActive />);
    fireEvent.click(screen.getByText('Add alarm'));
    expect(container.querySelector('[data-gesture="claim"]')).toBeTruthy();
    unmount();
    render(<AlarmApp isActive={false} />);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('catches up the countdown at once when it becomes active again', () => {
    useAlarms.setState({ alarms: [daily] });
    const { rerender } = render(<AlarmApp isActive={false} />);
    expect(screen.getByText('in 8h 32m')).toBeTruthy();
    vi.setSystemTime(new Date(2026, 9, 3, 0, 38, 0)); // two hours pass while swiped away
    rerender(<AlarmApp isActive />);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByText('in 6h 32m')).toBeTruthy();
  });
});
