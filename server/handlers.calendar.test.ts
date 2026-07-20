import { describe, it, expect } from 'vitest';
import ical from 'node-ical';
import { eventsFromParsed } from './handlers';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-1
SUMMARY:Dinner with Alex
LOCATION:Bar Centrale
DESCRIPTION:Table booked under Nick
DTSTART:20260719T183000Z
DTEND:20260719T203000Z
END:VEVENT
BEGIN:VEVENT
UID:evt-2
SUMMARY:Far Future
DTSTART:20261231T090000Z
DTEND:20261231T100000Z
END:VEVENT
END:VCALENDAR`;

describe('eventsFromParsed', () => {
  const data = ical.parseICS(ICS);
  const from = new Date('2026-07-01T00:00:00Z');
  const to = new Date('2026-08-01T00:00:00Z');

  it('includes events overlapping the range with location/description/uid', () => {
    const events = eventsFromParsed(data, from, to);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.uid).toBe('evt-1');
    expect(e.title).toBe('Dinner with Alex');
    expect(e.location).toBe('Bar Centrale');
    expect(e.description).toBe('Table booked under Nick');
    expect(e.allDay).toBe(false);
  });

  it('excludes events outside the range', () => {
    const events = eventsFromParsed(data, from, to);
    expect(events.find((e) => e.uid === 'evt-2')).toBeUndefined();
  });
});
