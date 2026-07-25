import type { CalendarEvent } from '../../api/types';
import { countdownLabel, sameDay } from './calendar-utils';

interface DetailsViewProps {
  event: CalendarEvent;
  now: Date;
  timeFormat: '24h' | '12h';
}

const RED = '#E0342B';
const GRAY = '#8A8A8A';

function fmtTime(iso: string, timeFormat: '24h' | '12h'): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h',
  });
}

/** Drill view: single event. Time range flips to a countdown inside 12h. */
export default function DetailsView({ event, now, timeFormat }: DetailsViewProps) {
  const start = new Date(event.start);
  const isToday = sameDay(start, now);
  const dateLine = isToday
    ? `Today · ${start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
    : start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const countdown = event.allDay ? null : countdownLabel(start, now);
  const timeLine = event.allDay
    ? 'All day'
    : `${fmtTime(event.start, timeFormat)} – ${fmtTime(event.end, timeFormat)}`;

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <div className="absolute inset-0 left-[16%] right-[16%] flex flex-col items-center justify-center text-center gap-[2.6vmin]">
        <div className="text-white font-semibold text-[5.4vmin] leading-tight">{event.title}</div>
        {countdown ? (
          <div className="font-medium text-[4.2vmin]" style={{ color: RED }}>{countdown}</div>
        ) : (
          <div className="text-white text-[4vmin]">{timeLine}</div>
        )}
        <div className="text-[3vmin]" style={{ color: GRAY }}>{dateLine}</div>
        {event.location && (
          <div className="text-white/60 text-[2.8vmin] truncate max-w-full">{event.location}</div>
        )}
      </div>
    </div>
  );
}
