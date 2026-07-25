import type { CalendarEvent } from '../../api/types';
import { monthWeeks, eventsForDay, sameDay, type WeekStart } from './calendar-utils';

interface MonthViewProps {
  focusDate: Date;
  now: Date;
  events: CalendarEvent[];
  weekStart: WeekStart;
  onSelectDay: (day: Date) => void;
  onStepMonth: (delta: number) => void;
  onSnapToday: () => void;
}

const ORANGE = '#FF8A1E';
const GRAY = '#8A8A8A';
const MAX_DOTS = 2;
const SUNDAY_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONDAY_FIRST = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Month grid. Rim tap zones step months; title tap snaps focus back to today. */
export default function MonthView({
  focusDate, now, events, weekStart, onSelectDay, onStepMonth, onSnapToday,
}: MonthViewProps) {
  const weeks = monthWeeks(focusDate, weekStart);
  const title = focusDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const headers = weekStart === 'monday' ? MONDAY_FIRST : SUNDAY_FIRST;

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <button
        onClick={onSnapToday}
        className="absolute top-[8%] left-1/2 -translate-x-1/2 bg-transparent border-0 font-semibold text-[4vmin] whitespace-nowrap"
        style={{ color: ORANGE }}
      >
        {title}
      </button>

      <div className="absolute top-[18%] left-[17%] w-[66%] grid grid-cols-7 gap-x-[0.6vmin] text-center">
        {headers.map((h, i) => (
          <div key={i} className="text-[2.2vmin] pb-[1vmin]" style={{ color: GRAY }}>{h}</div>
        ))}
      </div>

      <div className="absolute top-[24%] bottom-[13%] left-[17%] w-[66%] flex flex-col justify-between">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-x-[0.6vmin]">
            {week.map((day) => {
              const inMonth = day.getMonth() === focusDate.getMonth();
              const isToday = sameDay(day, now);
              const dots = Math.min(eventsForDay(events, day).length, MAX_DOTS);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onSelectDay(day)}
                  className="flex flex-col items-center bg-transparent border-0 p-0"
                >
                  <span
                    className="flex items-center justify-center rounded-[1.2vmin] w-[5.4vmin] h-[5.4vmin] text-[2.8vmin] tabular-nums"
                    style={{
                      background: isToday ? ORANGE : 'transparent',
                      color: isToday ? '#fff' : inMonth ? '#fff' : 'rgba(255,255,255,0.25)',
                      fontWeight: isToday ? 600 : 400,
                    }}
                  >
                    {day.getDate()}
                  </span>
                  <span className="flex gap-[0.5vmin] h-[1vmin] items-center">
                    {Array.from({ length: dots }, (_, i) => (
                      <span
                        key={i}
                        className="rounded-full"
                        style={{ width: '0.7vmin', height: '0.7vmin', background: ORANGE }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Invisible rim zones: tap left/right edge to step months. */}
      <button
        aria-label="Previous month"
        onClick={() => onStepMonth(-1)}
        className="absolute left-0 top-0 bottom-0 w-[15%] bg-transparent border-0"
      />
      <button
        aria-label="Next month"
        onClick={() => onStepMonth(1)}
        className="absolute right-0 top-0 bottom-0 w-[15%] bg-transparent border-0"
      />
    </div>
  );
}
