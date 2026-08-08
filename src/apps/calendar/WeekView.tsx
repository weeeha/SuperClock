import type { CalendarEvent } from '../../api/types';
import { weekDays, eventsForDay, sameDay, type WeekStart } from './calendar-utils';

interface WeekViewProps {
  now: Date;
  events: CalendarEvent[];
  weekStart: WeekStart;
  onSelectDay: (day: Date) => void;
}

const RED = '#E0342B';
const GRAY = '#8A8A8A';
const MAX_PILLS = 2;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function rangeLabel(days: Date[]): string {
  const first = days[0];
  const last = days[6];
  const mon = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  if (first.getMonth() === last.getMonth()) {
    return `${mon(first)} ${first.getDate()}–${last.getDate()}`;
  }
  return `${mon(first)} ${first.getDate()} – ${mon(last)} ${last.getDate()}`;
}

/** Agenda strip for the current week — one row per day, event-title pills right. */
export default function WeekView({ now, events, weekStart, onSelectDay }: WeekViewProps) {
  const days = weekDays(now, weekStart);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <p
        className="absolute top-[8.5%] left-0 right-0 text-center text-[2.6vmin] font-medium tracking-[0.18em]"
        style={{ color: GRAY }}
      >
        THIS WEEK &middot; {rangeLabel(days)}
      </p>

      <div className="absolute top-[17%] bottom-[13%] left-[17%] w-[66%] flex flex-col justify-between">
        {days.map((day) => {
          const isToday = sameDay(day, now);
          const dayEvents = eventsForDay(events, day);
          const overflow = dayEvents.length - MAX_PILLS;
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className="flex items-center gap-[2vmin] bg-transparent border-0 text-left min-h-0"
            >
              <span
                className="flex-none flex items-baseline justify-center gap-[0.8vmin] rounded-[1.4vmin] px-[1vmin] py-[0.6vmin] w-[11vmin]"
                style={isToday ? { background: RED } : undefined}
              >
                <span className="text-[2.2vmin]" style={{ color: isToday ? 'rgba(255,255,255,0.8)' : GRAY }}>
                  {DAY_LETTERS[day.getDay()]}
                </span>
                <span className="text-white text-[3vmin] font-medium tabular-nums">{day.getDate()}</span>
              </span>

              <span className="flex items-center gap-[1vmin] min-w-0">
                {dayEvents.slice(0, MAX_PILLS).map((e) => (
                  <span
                    key={e.uid}
                    className="rounded-full bg-white/10 text-white text-[2.2vmin] px-[1.6vmin] py-[0.5vmin] truncate max-w-[22vmin]"
                  >
                    {e.title}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="text-[2.2vmin] flex-none" style={{ color: GRAY }}>+{overflow}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
