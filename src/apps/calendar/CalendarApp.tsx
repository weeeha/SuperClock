import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

/** Calendar screen — based on Figma S13 design (489:21033) */
export default function CalendarApp({ isActive }: AppProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, [isActive]);

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const date = now.getDate();
  const month = now.toLocaleDateString('en-US', { month: 'long' });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black gap-[4%]">
      {/* Day name */}
      <p className="text-[8vmin] font-semibold text-white">{dayName}</p>

      {/* Date badge */}
      <div className="flex items-center justify-center rounded-3xl bg-[#E33030] w-[40%] aspect-square">
        <p className="text-[24vmin] font-bold text-white leading-none">{date}</p>
      </div>

      {/* Month */}
      <p className="text-[8vmin] font-semibold text-white">{month}</p>
    </div>
  );
}
