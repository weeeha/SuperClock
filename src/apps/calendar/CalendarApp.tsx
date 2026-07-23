import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import type { CalendarEvent } from '../../api/types';
import { useNavigation } from '../../core/navigation';
import { calendarAppSchema } from '../../shared/schemas/app.calendar';
import { useCalendarEvents } from './useCalendarEvents';
import { addDays, addMonths, monthWeeks, startOfWeek } from './calendar-utils';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DetailsView from './DetailsView';

type View = 'month' | 'week' | 'details';

export default function CalendarApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = calendarAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : calendarAppSchema.parse({});
  }, [config]);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);

  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<View>(cfg.defaultView);
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  // Roll `now` over roughly each minute so "today"/relative-time stay fresh.
  useEffect(() => {
    if (!isActive) return;
    const tick = () => setNow(new Date());
    tick(); // refresh immediately on (re)activation so "today" isn't up to 60s stale
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isActive]);

  // Fetch range covers the visible month grid (month view is the widest need).
  const [fromIso, toIso] = useMemo(() => {
    const weeks = monthWeeks(focusDate, cfg.weekStart);
    const from = weeks[0][0];
    const to = addDays(weeks[weeks.length - 1][6], 1);
    return [from.toISOString(), to.toISOString()];
  }, [focusDate, cfg.weekStart]);

  const { events, offline } = useCalendarEvents(fromIso, toIso, isActive);

  // Vertical swipe = step through time at the current level.
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    setVerticalSwipeCallback((dir) => {
      if (view === 'details') return;
      const delta = dir === 'up' ? 1 : -1; // up = forward in time
      setFocusDate((d) => (view === 'month' ? addMonths(d, delta) : addDays(d, delta * 7)));
    });
    return () => setVerticalSwipeCallback(null);
  }, [isActive, view, setVerticalSwipeCallback]);

  if (view === 'details' && selected) {
    return (
      <DetailsView
        event={selected}
        now={now}
        timeFormat={cfg.timeFormat}
        onBack={() => setView('week')}
      />
    );
  }

  if (view === 'week') {
    return (
      <WeekView
        focusDate={focusDate}
        now={now}
        events={events}
        weekStart={cfg.weekStart}
        timeFormat={cfg.timeFormat}
        offline={offline}
        onBack={() => setView('month')}
        onSelectEvent={(e) => {
          setSelected(e);
          setView('details');
        }}
      />
    );
  }

  return (
    <MonthView
      focusDate={focusDate}
      now={now}
      events={events}
      weekStart={cfg.weekStart}
      offline={offline}
      onSelectWeek={(day) => {
        setFocusDate(startOfWeek(day, cfg.weekStart));
        setView('week');
      }}
    />
  );
}
