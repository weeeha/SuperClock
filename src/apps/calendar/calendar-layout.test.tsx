// @vitest-environment jsdom
// The honest tell ("calendar not configured" / "offline · cached") sits in a
// band above the pager dots. November 2026 has six week rows, and on
// 2026-11-01 the sixth row ran under the sentence: the month grid and the
// tell were placed independently. The grid now ends above the tell's band.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import MonthView from './MonthView';
import { CALENDAR_TELL, MONTH_GRID_BOTTOM_PCT } from './calendar-layout';

afterEach(cleanup);

describe('calendar layout', () => {
  it('the month grid ends above the band the tell occupies', () => {
    expect(MONTH_GRID_BOTTOM_PCT).toBeGreaterThanOrEqual(CALENDAR_TELL.bottomPct + CALENDAR_TELL.heightPct);
  });

  it('MonthView draws its weeks band from the shared constant', () => {
    const { container } = render(
      <MonthView
        focusDate={new Date(2026, 10, 1)}
        now={new Date(2026, 10, 1)}
        events={[]}
        weekStart="monday"
        onSelectDay={() => {}}
        onStepMonth={() => {}}
        onSnapToday={() => {}}
      />,
    );
    const band = container.querySelector<HTMLElement>('[data-band="weeks"]');
    expect(band).not.toBeNull();
    expect(band!.style.bottom).toBe(`${MONTH_GRID_BOTTOM_PCT}%`);
    // Six rows in November 2026: the case that overlapped.
    expect(band!.children.length).toBe(6);
  });
});
