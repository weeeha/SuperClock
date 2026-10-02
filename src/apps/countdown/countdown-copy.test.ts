import { describe, it, expect } from 'vitest';
import { countdownCopy } from './countdown-copy';
import { countdownState, parseDate } from './countdown-state';
import { countdownAppSchema } from '../../shared/schemas/app.countdown';

const copy = (today: string, over: Record<string, unknown>) => {
  const config = countdownAppSchema.parse(over);
  return countdownCopy(countdownState(parseDate(today)!, config), config);
};

describe('countdownCopy', () => {
  it('days until', () => {
    expect(copy('2026-08-08', { targetDate: '2027-03-10', label: 'Tokyo' })).toEqual({
      headline: '214', line: 'days to Tokyo', caption: null, muted: false,
    });
  });
  it('singular day', () => {
    expect(copy('2027-03-09', { targetDate: '2027-03-10', label: 'Tokyo' }).line).toBe('day to Tokyo');
  });
  it('drops "to" when there is no label', () => {
    expect(copy('2026-08-08', { targetDate: '2027-03-10' }).line).toBe('days');
  });
  it('weeks with and without remainder, singular forms', () => {
    const w = { targetDate: '2027-03-10', label: 'Tokyo', style: 'weeks' };
    expect(copy('2026-08-08', w)).toMatchObject({ headline: '30', line: 'weeks, 4 days to Tokyo' });
    expect(copy('2027-02-24', w).line).toBe('weeks to Tokyo');
    expect(copy('2027-03-03', w).line).toBe('week to Tokyo');
    expect(copy('2027-03-02', w).line).toBe('week, 1 day to Tokyo');
  });
  it('today', () => {
    expect(copy('2027-03-10', { targetDate: '2027-03-10', label: 'Tokyo' })).toEqual({
      headline: 'Today', line: 'Tokyo', caption: null, muted: false,
    });
    expect(copy('2027-03-10', { targetDate: '2027-03-10' }).line).toBe('');
  });
  it('since is muted and counts up', () => {
    expect(copy('2027-03-22', { targetDate: '2027-03-10', label: 'Tokyo' })).toEqual({
      headline: '12', line: 'days since Tokyo', caption: null, muted: true,
    });
    expect(copy('2027-03-11', { targetDate: '2027-03-10', label: 'Tokyo' }).line).toBe('day since Tokyo');
  });
  it('ring captions: start date, or the missing-start prompt', () => {
    const r = { targetDate: '2027-03-10', label: 'Tokyo', style: 'progress-ring' };
    expect(copy('2026-08-08', { ...r, startDate: '2026-06-04' }).caption).toBe('since 4 Jun 2026');
    expect(copy('2026-08-08', r).caption).toBe('Add a start date to show progress');
    expect(copy('2027-03-22', { ...r, startDate: '2026-06-04' }).caption).toBeNull();
  });
  it('not set up', () => {
    expect(copy('2026-10-01', {})).toEqual({
      headline: 'No date yet', line: 'Set a target date for this screen in the admin.', caption: null, muted: false,
    });
  });
});
