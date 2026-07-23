import type { CalendarEvent } from '../../api/types';
import { relativeTime, sameDay } from './calendar-utils';
import BackChevron from './BackChevron';

interface DetailsViewProps {
  event: CalendarEvent;
  now: Date;
  timeFormat: '24h' | '12h';
  onBack: () => void;
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

export default function DetailsView({ event, now, timeFormat, onBack }: DetailsViewProps) {
  const start = new Date(event.start);
  const isToday = sameDay(start, now);
  const dateLine = isToday
    ? `Today · ${start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
    : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLine = event.allDay
    ? 'All day'
    : `${fmtTime(event.start, timeFormat)} – ${fmtTime(event.end, timeFormat)}`;

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <BackChevron onBack={onBack} />
      <div className="absolute inset-0 left-[16%] right-[16%] flex flex-col items-center justify-center text-center gap-[3vmin]">
        <span className="rounded-full" style={{ width: '2.4vmin', height: '2.4vmin', background: colorFor(event) }} />
        <div className="text-white font-medium text-[5vmin] leading-tight">{event.title}</div>
        <div className="font-medium text-[3.4vmin]" style={{ color: isToday ? RED : 'rgba(255,255,255,0.8)' }}>
          {dateLine}
        </div>
        <div className="text-white text-[4vmin]">{timeLine}</div>
        {event.location && (
          <div className="text-white/70 text-[3vmin]">{event.location}</div>
        )}
        {event.description && (
          <div className="text-white/50 text-[2.6vmin] leading-snug max-w-[95%]">{event.description}</div>
        )}
        {!event.allDay && (
          <div className="text-white/40 text-[2.4vmin]">{relativeTime(start, now)}</div>
        )}
      </div>
    </div>
  );
}
