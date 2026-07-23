import type { CalendarEvent } from '../../api/types';
import { monthWeeks, eventsForDay, sameDay, type WeekStart } from './calendar-utils';

interface MonthViewProps {
  focusDate: Date;
  now: Date;
  events: CalendarEvent[];
  weekStart: WeekStart;
  offline: boolean;
  onSelectWeek: (day: Date) => void;
}

const RED = '#E33030';

export default function MonthView({ focusDate, now, events, weekStart, offline, onSelectWeek }: MonthViewProps) {
  const weeks = monthWeeks(focusDate, weekStart);
  const monthLabel = focusDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const currentIdx = weeks.findIndex((w) => w.some((d) => sameDay(d, now)));

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <p className="absolute top-[7%] left-0 right-0 text-center text-white font-medium text-[3.6vmin]">
        {monthLabel}
      </p>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[0.6vmin]">
        {weeks.map((week, wi) => {
          const distance = currentIdx < 0 ? 0 : Math.abs(wi - currentIdx);
          const isCurrent = wi === currentIdx;
          const opacity = isCurrent ? 1 : Math.max(0.3, 0.7 - distance * 0.18);
          const size = isCurrent ? 3.6 : Math.max(1.8, 2.6 - distance * 0.3);
          return (
            <button
              key={wi}
              onClick={() => onSelectWeek(week[0])}
              className="flex justify-center gap-[1.2vmin] bg-transparent border-0 w-[70%]"
              style={{ opacity }}
            >
              {week.map((day) => {
                const inMonth = day.getMonth() === focusDate.getMonth();
                const isToday = sameDay(day, now);
                const hasEvent = eventsForDay(events, day).length > 0;
                return (
                  <span
                    key={day.toISOString()}
                    className="relative flex-1 text-center"
                    style={{
                      fontSize: `${size}vmin`,
                      color: isToday ? RED : inMonth ? '#fff' : 'rgba(255,255,255,0.25)',
                      fontWeight: isToday ? 600 : 400,
                    }}
                  >
                    {day.getDate()}
                    {hasEvent && (
                      <span
                        className="absolute left-1/2 -translate-x-1/2 rounded-full"
                        style={{
                          bottom: '-0.4vmin', width: '0.7vmin', height: '0.7vmin',
                          background: isToday ? RED : '#fff',
                        }}
                      />
                    )}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>

      {offline && (
        <p className="absolute bottom-[10%] left-0 right-0 text-center text-white/40 text-[2.4vmin]">
          can’t reach calendar
        </p>
      )}
    </div>
  );
}
