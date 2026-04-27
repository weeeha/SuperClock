import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import type { CalendarEvent } from '../../api/types';

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Calendar screen — based on Figma S13 design (489:21033). Upcoming events via /api/calendar. */
export default function CalendarApp({ isActive }: AppProps) {
  const [now, setNow] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/calendar');
        if (!res.ok) return;
        const data = (await res.json()) as CalendarEvent[];
        if (!cancelled) setEvents(data);
      } catch {
        // network error → keep current state, calendar shows date only
      }
    }
    load();
    if (!isActive) return;
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isActive]);

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const date = now.getDate();
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const upcoming = events.slice(0, 3);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black gap-[3%]">
      <p className="text-[7vmin] font-semibold text-white">{dayName}</p>

      <div className="flex items-center justify-center rounded-3xl bg-[#E33030] w-[36%] aspect-square">
        <p className="text-[22vmin] font-bold text-white leading-none">{date}</p>
      </div>

      <p className="text-[7vmin] font-semibold text-white">{month}</p>

      {upcoming.length > 0 && (
        <div className="flex flex-col items-center gap-[1vmin] mt-[1%] max-w-[80%]">
          {upcoming.map((event, i) => (
            <p
              key={`${event.start}-${i}`}
              className="text-[3.2vmin] text-white/70 truncate max-w-full"
            >
              {event.allDay ? '· ' : `${formatTime(event.start)}  ·  `}
              {event.title}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
