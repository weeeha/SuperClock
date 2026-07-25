import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../../core/types';
import type { CalendarEvent } from '../../api/types';
import { useNavigation } from '../../core/navigation';
import { calendarAppSchema } from '../../shared/schemas/app.calendar';
import { useCalendarEvents } from './useCalendarEvents';
import { addDays, addMonths, eventsForDay, monthWeeks } from './calendar-utils';
import CoverView from './CoverView';
import WeekView from './WeekView';
import MonthView from './MonthView';
import YearView from './YearView';
import DayView from './DayView';
import DetailsView from './DetailsView';

type LadderView = 'cover' | 'week' | 'month' | 'year';
const LADDER: readonly LadderView[] = ['cover', 'week', 'month', 'year'];

type Drill =
  | { kind: 'day'; day: Date }
  | { kind: 'details'; day: Date; event: CalendarEvent };

const IDLE_RESET_MS = 60_000;
const IDLE_CHECK_MS = 7_000;

export default function CalendarApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = calendarAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : calendarAppSchema.parse({});
  }, [config]);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<LadderView>(cfg.defaultView);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [focusDate, setFocusDate] = useState(() => new Date());
  // 0 sentinel (react-compiler purity: no Date.now() during render); the
  // isActive effect below stamps a real timestamp before any idle check runs.
  const lastInteractionRef = useRef(0);

  const bump = () => {
    lastInteractionRef.current = Date.now();
  };

  // Roll `now` over roughly each minute so "today"/countdowns stay fresh.
  useEffect(() => {
    if (!isActive) return;
    const tick = () => setNow(new Date());
    tick(); // refresh immediately on (re)activation so "today" isn't up to 60s stale
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isActive]);

  // Fresh 60s idle budget each time the app becomes active.
  useEffect(() => {
    if (isActive) lastInteractionRef.current = Date.now();
  }, [isActive]);

  // Idle return: 60s without interaction while away from cover → back to resting.
  useEffect(() => {
    if (!isActive) return;
    if (view === 'cover' && !drill) return; // already resting — nothing to reset
    const id = setInterval(() => {
      if (Date.now() - lastInteractionRef.current < IDLE_RESET_MS) return;
      setDrill(null);
      setView('cover');
      setFocusDate(new Date()); // resting = today; drop any stepped-month/year focus
    }, IDLE_CHECK_MS);
    return () => clearInterval(id);
  }, [isActive, view, drill]);

  // Fetch range follows the deepest active need: the whole focus year while the
  // year view is up, otherwise the visible month grid. `now` re-derives the same
  // ISO strings each minute, so the memo churn never re-triggers a fetch.
  const [fromIso, toIso] = useMemo(() => {
    if (view === 'year') {
      const y = focusDate.getFullYear();
      return [new Date(y, 0, 1).toISOString(), new Date(y + 1, 0, 1).toISOString()];
    }
    // Cover/week track today; month tracks the (possibly stepped) focus month.
    const anchor = view === 'month' ? focusDate : now;
    const weeks = monthWeeks(anchor, cfg.weekStart);
    const from = weeks[0][0];
    const to = addDays(weeks[weeks.length - 1][6], 1);
    return [from.toISOString(), to.toISOString()];
  }, [view, focusDate, now, cfg.weekStart]);

  const { events, offline } = useCalendarEvents(fromIso, toIso, isActive);
  const todayEvents = useMemo(() => eventsForDay(events, now), [events, now]);

  // Vertical swipe: climbs/descends the zoom ladder; while drilled, swipe down
  // pops the drill stack and swipe up is ignored. Swipe down at cover falls
  // through to the shell's grid gesture (Habits pattern, guarded cleanup).
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    const cb = (dir: 'up' | 'down') => {
      lastInteractionRef.current = Date.now();
      if (drill) {
        if (dir === 'down') {
          setDrill(drill.kind === 'details' ? { kind: 'day', day: drill.day } : null);
        }
        return; // swipe up ignored while drilled
      }
      const idx = LADDER.indexOf(view);
      if (dir === 'up') {
        if (idx < LADDER.length - 1) setView(LADDER[idx + 1]);
      } else if (idx > 0) {
        setView(LADDER[idx - 1]);
      } else {
        showGrid(); // swipe down at cover = the shell's default gesture
      }
    };
    setVerticalSwipeCallback(cb);
    return () => {
      // popLayout keeps the exiting app mounted after the next app registers —
      // only clear the slot if it's still ours.
      if (useNavigation.getState().verticalSwipeCallback === cb) setVerticalSwipeCallback(null);
    };
  }, [isActive, view, drill, setVerticalSwipeCallback, showGrid]);

  let content;
  if (drill?.kind === 'details') {
    content = (
      <DetailsView
        event={drill.event}
        now={now}
        timeFormat={cfg.timeFormat}
        onBack={() => {
          bump();
          setDrill({ kind: 'day', day: drill.day });
        }}
      />
    );
  } else if (drill?.kind === 'day') {
    content = (
      <DayView
        day={drill.day}
        now={now}
        events={events}
        timeFormat={cfg.timeFormat}
        onSelectEvent={(e) => {
          bump();
          setDrill({ kind: 'details', day: drill.day, event: e });
        }}
      />
    );
  } else if (view === 'cover') {
    content = <CoverView now={now} todayEvents={todayEvents} />;
  } else if (view === 'week') {
    content = (
      <WeekView
        now={now}
        events={events}
        weekStart={cfg.weekStart}
        onSelectDay={(day) => {
          bump();
          setDrill({ kind: 'day', day });
        }}
      />
    );
  } else if (view === 'month') {
    content = (
      <MonthView
        focusDate={focusDate}
        now={now}
        events={events}
        weekStart={cfg.weekStart}
        onSelectDay={(day) => {
          bump();
          setDrill({ kind: 'day', day });
        }}
        onStepMonth={(delta) => {
          bump();
          setFocusDate((d) => addMonths(d, delta));
        }}
        onSnapToday={() => {
          bump();
          setFocusDate(new Date());
        }}
      />
    );
  } else {
    content = (
      <YearView
        focusDate={focusDate}
        now={now}
        events={events}
        weekStart={cfg.weekStart}
        onSelectMonth={(m) => {
          bump();
          setFocusDate(new Date(focusDate.getFullYear(), m, 1));
          setView('month');
        }}
        onStepYear={(delta) => {
          bump();
          setFocusDate((d) => addMonths(d, delta * 12));
        }}
      />
    );
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {content}
      {offline && (
        <p className="absolute bottom-[7.5%] left-0 right-0 text-center text-white/40 text-[2.2vmin] pointer-events-none">
          offline · cached
        </p>
      )}
      {!drill && (
        <div className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
          {LADDER.map((v) => (
            <div
              key={v}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${view === v ? 'bg-white' : 'bg-white/25'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
