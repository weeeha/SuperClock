import type { CalendarEvent } from '../../api/types';

interface CoverViewProps {
  now: Date;
  todayEvents: CalendarEvent[];
}

const RED = '#E0342B';
const MAX_DOTS = 4;

/** Resting view: big Apple-Calendar-style date tile + one dot per event today. */
export default function CoverView({ now, todayEvents }: CoverViewProps) {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const count = todayEvents.length;

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3vmin]">
        <div className="text-white font-medium text-[6.4vmin]">{weekday}</div>
        <div
          className="flex items-center justify-center rounded-[4vmin]"
          style={{ background: RED, width: '32vmin', height: '28vmin' }}
        >
          <span className="text-white font-bold leading-none text-[17vmin]">{now.getDate()}</span>
        </div>
        <div className="text-white/70 text-[4.2vmin]">{month}</div>

        <div className="flex items-center gap-[1.4vmin] h-[3vmin]">
          {count > 0 && count <= MAX_DOTS &&
            todayEvents.map((e) => (
              <span
                key={e.uid}
                className="rounded-full bg-white/60"
                style={{ width: '1.2vmin', height: '1.2vmin' }}
              />
            ))}
          {count > MAX_DOTS && (
            <span className="text-white/60 text-[2.6vmin]">{count} events</span>
          )}
        </div>
      </div>
    </div>
  );
}
