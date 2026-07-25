import type { CalendarEvent } from '../../api/types';
import { eventsForDay } from './calendar-utils';

interface DayViewProps {
  day: Date;
  now: Date;
  events: CalendarEvent[];
  timeFormat: '24h' | '12h';
  onSelectEvent: (e: CalendarEvent) => void;
}

const RED = '#E0342B';
const GRAY = '#8A8A8A';

function fmtTime(iso: string, timeFormat: '24h' | '12h'): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h',
  });
}

/** Drill view: one day's agenda. All-day pills pinned top, timed rows below. */
export default function DayView({ day, events, timeFormat, onSelectEvent }: DayViewProps) {
  const dayEvents = eventsForDay(events, day).sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });
  const allDay = dayEvents.filter((e) => e.allDay);
  const timed = dayEvents.filter((e) => !e.allDay);
  const header = `${day.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()} · ` +
    `${day.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${day.getDate()}`;

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <p
        className="absolute top-[8.5%] left-0 right-0 text-center text-[2.6vmin] font-medium tracking-[0.18em]"
        style={{ color: GRAY }}
      >
        {header}
      </p>

      <div className="absolute top-[16%] bottom-[12%] left-[17%] w-[66%] flex flex-col gap-[1.4vmin]">
        {allDay.length > 0 && (
          <div className="flex flex-wrap gap-[1vmin] flex-none">
            {allDay.map((e) => (
              <button
                key={e.uid}
                onClick={() => onSelectEvent(e)}
                className="rounded-full border-0 text-white text-[2.2vmin] px-[1.8vmin] py-[0.6vmin] truncate max-w-full"
                style={{ background: 'rgba(224,52,43,0.28)' }}
              >
                {e.title}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto calendar-scroll flex flex-col gap-[1.2vmin]">
          {dayEvents.length === 0 && (
            <p className="text-center text-white/40 text-[2.6vmin] mt-[8vmin]">Nothing scheduled</p>
          )}
          {timed.map((e) => (
            <button
              key={e.uid}
              onClick={() => onSelectEvent(e)}
              className="flex items-center gap-[1.6vmin] bg-transparent border-0 text-left flex-none"
            >
              <span className="text-[2.4vmin] tabular-nums flex-none w-[11vmin] text-right" style={{ color: GRAY }}>
                {fmtTime(e.start, timeFormat)}
              </span>
              <span className="flex-none rounded-full self-stretch" style={{ width: '0.5vmin', background: RED }} />
              <span className="text-white text-[2.8vmin] truncate py-[0.6vmin]">{e.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
