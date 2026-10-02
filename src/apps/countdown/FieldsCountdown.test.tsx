// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import FieldsCountdown from './FieldsCountdown';
import { countdownState } from './countdown-state';
import { countdownAppSchema, type CountdownAppConfig } from '../../shared/schemas/app.countdown';

afterEach(cleanup);

const TODAY = { y: 2026, m: 10, d: 1 }; // Thursday 1 October 2026
const cfg = (c: Partial<CountdownAppConfig>) => countdownAppSchema.parse(c);
const draw = (c: Partial<CountdownAppConfig>) => {
  const config = cfg(c);
  return render(<FieldsCountdown view={countdownState(TODAY, config)} config={config} />);
};

describe('FieldsCountdown', () => {
  it('counts the days to the date, with the label as the title', () => {
    draw({ label: 'Lisbon', targetDate: '2026-10-24' });
    expect(screen.getByText('Lisbon')).toBeTruthy();
    expect(screen.getByText('23')).toBeTruthy();
    expect(screen.getByText('days to go')).toBeTruthy();
    expect(screen.getByText('Saturday 24 October')).toBeTruthy();
  });

  it('uses the weeks phrasing when the style asks for it', () => {
    draw({ label: 'Lisbon', targetDate: '2026-10-24', style: 'weeks' });
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('weeks, 2 days to go')).toBeTruthy();
  });

  it('says Today on the day', () => {
    draw({ label: 'Lisbon', targetDate: '2026-10-01' });
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('The day is here')).toBeTruthy();
    expect(screen.getAllByText('Lisbon')).toHaveLength(1); // the title carries the label, once
    expect(screen.getByText('Thursday 1 October')).toBeTruthy();
  });

  it('counts up after the date in the soft ink', () => {
    draw({ label: 'Tokyo', targetDate: '2026-09-19' });
    const n = screen.getByText('12');
    expect(n.getAttribute('style')).toContain('--fields-countdown-ink-soft');
    expect(screen.getByText('days since')).toBeTruthy();
  });

  it('asks for a date when none is set', () => {
    draw({});
    expect(screen.getByText('No date yet')).toBeTruthy();
    expect(screen.getByText('Set a date in the admin')).toBeTruthy();
    expect(screen.getByText('Countdown')).toBeTruthy();
  });

  it('draws the progress ring and its caption for the ring style', () => {
    const { container } = draw({ label: 'Lisbon', targetDate: '2026-10-24', style: 'progress-ring', startDate: '2025-11-14' });
    expect(container.querySelectorAll('circle[stroke-width="36"]')).toHaveLength(2);
    expect(screen.getByText('since 14 Nov 2025')).toBeTruthy();
  });
});
