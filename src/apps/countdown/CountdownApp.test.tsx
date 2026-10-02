// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import CountdownApp from './CountdownApp';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 8, 9, 0, 0)); // 8 Aug 2026, local
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CountdownApp', () => {
  it('shows days until the date', () => {
    render(<CountdownApp isActive config={{ targetDate: '2027-03-10', label: 'Tokyo' }} />);
    expect(screen.getByText('214')).toBeTruthy();
    expect(screen.getByText('days to Tokyo').className).toContain('line-clamp-2');
  });

  it('shows the not-set-up sentence without a date', () => {
    render(<CountdownApp isActive config={{}} />);
    expect(screen.getByText('No date yet')).toBeTruthy();
    expect(screen.getByText('Set a target date for this screen in the admin.')).toBeTruthy();
  });

  it('falls back to defaults on invalid config instead of crashing', () => {
    render(<CountdownApp isActive config={{ label: 'x'.repeat(41), targetDate: '2027-03-10' }} />);
    expect(screen.getByText('No date yet')).toBeTruthy();
  });

  it('draws the accent ring only before the date, and a muted full ring after', () => {
    const { container, rerender } = render(
      <CountdownApp isActive config={{ targetDate: '2027-03-10', style: 'progress-ring', startDate: '2026-06-04' }} />,
    );
    expect(container.querySelector('circle.stroke-\\(--color-accent\\)')).toBeTruthy();
    rerender(<CountdownApp isActive config={{ targetDate: '2026-08-01', style: 'progress-ring', startDate: '2026-06-04' }} />);
    expect(container.querySelector('circle.stroke-\\(--color-accent\\)')).toBeNull();
    expect(container.querySelector('circle.stroke-\\(--face-ink-muted\\)')).toBeTruthy();
  });

  it('draws no ring and prompts when the start date is missing', () => {
    const { container } = render(<CountdownApp isActive config={{ targetDate: '2027-03-10', style: 'progress-ring' }} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('Add a start date to show progress')).toBeTruthy();
  });

  it('schedules nothing while inactive, one timeout while active', () => {
    render(<CountdownApp isActive={false} config={{ targetDate: '2027-03-10' }} />);
    expect(vi.getTimerCount()).toBe(0);
    cleanup();
    render(<CountdownApp isActive config={{ targetDate: '2027-03-10' }} />);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('rolls over at local midnight', () => {
    render(<CountdownApp isActive config={{ targetDate: '2027-03-10' }} />);
    expect(screen.getByText('214')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(15 * 3600 * 1000 + 1000); // 09:00 -> 00:00:01 next day
    });
    expect(screen.getByText('213')).toBeTruthy();
    expect(vi.getTimerCount()).toBe(1);
  });
});
