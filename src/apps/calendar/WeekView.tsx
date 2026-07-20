import type { CalendarEvent } from '../../api/types';
import { weekDays, eventsForDay, groupEventsByDay, sameDay, type WeekStart } from './calendar-utils';
import BackChevron from './BackChevron';

interface WeekViewProps {
  focusDate: Date;
  now: Date;
  events: CalendarEvent[];
  weekStart: WeekStart;
  timeFormat: '24h' | '12h';
  offline: boolean;
  onBack: () => void;
  onSelectEvent: (e: CalendarEvent) => void;
}

const RED = '#E33030';
const COLORS = ['#4C9AFF', '#36B37E', '#B37FEB', '#FF8B00', '#00B8D9'];

function colorFor(e: CalendarEvent): string {
  if (!e.category) return '#8899AA';
  let h = 0;
  for (let i = 0; i < e.category.length; i++) h = (h * 31 + e.category.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function fmtTime(iso: string, timeFormat: '24h' | '12h'): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h',
  });
}

export default function WeekView({
  focusDate, now, events, weekStart, timeFormat, offline, onBack, onSelectEvent,
}: WeekViewProps) {
  const days = weekDays(focusDate, weekStart);
  const groups = groupEventsByDay(events, days);
  const range = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { day: 'numeric' })}`;
  const dayInitials = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <BackChevron label={range} onBack={onBack} />

      <div className="absolute top-[15%] left-[14%] w-[72%] grid grid-cols-7 gap-[0.4vmin] text-center">
        {days.map((day) => {
          const isToday = sameDay(day, now);
          const has = eventsForDay(events, day).length > 0;
          return (
            <div key={day.toISOString()} className="relative pb-[1.2vmin]">
              <div className="text-white/40 text-[2vmin]">{dayInitials[day.getDay()]}</div>
              <div className="text-[2.6vmin]" style={{ color: isToday ? RED : '#fff', fontWeight: isToday ? 600 : 400 }}>
                {day.getDate()}
              </div>
              {has && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: '0.7vmin', height: '0.7vmin', background: isToday ? RED : '#fff' }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute top-[31%] left-[15%] w-[70%] bottom-[12%] overflow-y-auto flex flex-col gap-[1vmin] calendar-scroll">
        {groups.length === 0 && (
          <p className="text-center text-white/40 text-[2.6vmin] mt-[6vmin]">
            {offline ? 'can’t reach calendar' : 'Nothing this week'}
          </p>
        )}
        {groups.map((g) => {
          const isToday = sameDay(g.day, now);
          const label = isToday
            ? `Today · ${g.day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}`
            : g.day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
          return (
            <div key={g.day.toISOString()} className="flex flex-col gap-[0.6vmin]">
              <div className="text-[2.2vmin] font-medium" style={{ color: isToday ? RED : 'rgba(255,255,255,0.55)' }}>
                {label}
              </div>
              {g.events.map((e) => (
                <button
                  key={e.uid}
                  onClick={() => onSelectEvent(e)}
                  className="flex items-center gap-[1.2vmin] bg-transparent border-0 text-left"
                >
                  <span className="rounded-full flex-none" style={{ width: '1.2vmin', height: '1.2vmin', background: colorFor(e) }} />
                  <span className="text-white/60 text-[2.2vmin] tabular-nums flex-none">
                    {e.allDay ? 'all day' : fmtTime(e.start, timeFormat)}
                  </span>
                  <span className="text-white text-[2.4vmin] truncate">{e.title}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
