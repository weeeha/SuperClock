// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import FieldsCalendar, { type FieldsCalendarProps } from './FieldsCalendar';
import type { CalendarEvent } from '../../api/types';

afterEach(cleanup);

const at = (h: number, m = 0, day = 1) => new Date(2026, 9, day, h, m).toISOString();
const ev = (title: string, s: [number, number], e: [number, number], day = 1): CalendarEvent => ({
  uid: `${title}-${day}`, title, allDay: false, start: at(s[0], s[1], day), end: at(e[0], e[1], day),
});
const DAY = [
  ev('Standup', [9, 0], [10, 0]),
  ev('Lunch', [12, 30], [13, 30]),
  ev('Design review', [15, 30], [16, 30]),
  ev('Gym', [18, 0], [19, 0]),
  ev('Dinner', [19, 30], [21, 0]),
];

const base: FieldsCalendarProps = {
  now: new Date(2026, 9, 1, 14, 0), events: DAY, timeFormat: '24h',
  offline: false, notConfigured: false, loading: false, page: 0, pageCount: 4,
};
const text = (c: HTMLElement) => c.textContent ?? '';

describe('FieldsCalendar', () => {
  it('leads with the next event, its countdown and what follows', () => {
    const { container } = render(<FieldsCalendar {...base} />);
    expect(screen.getByText('Thursday 1 October')).toBeTruthy();
    expect(screen.getByText('Up next')).toBeTruthy();
    expect(screen.getByText('15:30')).toBeTruthy();
    expect(screen.getByText('Design review')).toBeTruthy();
    expect(screen.getByText('in 1h 30m · until 16:30')).toBeTruthy();
    expect(screen.getByText('Gym')).toBeTruthy();
    expect(screen.getByText('18:00')).toBeTruthy();
    expect(screen.getByText('Dinner')).toBeTruthy();
    expect(text(container)).not.toContain('Standup'); // past events are not listed
  });

  it('says Now for an event that is on, with when it ends', () => {
    render(<FieldsCalendar {...base} now={new Date(2026, 9, 1, 12, 45)} />);
    expect(screen.getByText('Now')).toBeTruthy();
    expect(screen.getByText('Lunch')).toBeTruthy();
    expect(screen.getByText('until 13:30')).toBeTruthy();
  });

  it('clips long titles so a row never runs off the disc', () => {
    const long = [ev('Quarterly planning with the whole extended team', [15, 0], [16, 0]),
      ev('A very long follow-up meeting name', [17, 0], [18, 0])];
    const { container } = render(<FieldsCalendar {...base} events={long} />);
    expect(text(container)).toContain('Quarterly planning with…');
    expect(text(container)).toContain('A very long foll…');
  });

  it('says nothing else is on today and names tomorrow', () => {
    const events = [...DAY, ev('Standup', [9, 0], [10, 0], 2)];
    render(<FieldsCalendar {...base} events={events} now={new Date(2026, 9, 1, 22, 0)} />);
    expect(screen.getByText('Nothing else today')).toBeTruthy();
    expect(screen.getByText('Tomorrow · Standup 09:00')).toBeTruthy();
  });

  it('asks for a feed on the server when none is configured', () => {
    render(<FieldsCalendar {...base} events={[]} notConfigured />);
    expect(screen.getByText('No calendar yet')).toBeTruthy();
    expect(screen.getByText('Add a calendar feed on the server')).toBeTruthy();
  });

  it('never claims an empty day while the first fetch is in flight', () => {
    const { container } = render(<FieldsCalendar {...base} events={[]} loading />);
    expect(text(container)).toBe('Thursday 1 October');
  });

  it('says when it is showing saved events', () => {
    render(<FieldsCalendar {...base} offline />);
    expect(screen.getByText('Offline · saved events')).toBeTruthy();
    expect(screen.queryByText('in 1h 30m · until 16:30')).toBeNull(); // the chip takes the slot
  });

  it('uses the 12-hour clock when configured', () => {
    render(<FieldsCalendar {...base} timeFormat="12h" />);
    expect(screen.getByText('03:30 PM')).toBeTruthy();
  });
});
