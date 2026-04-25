import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

/** Weather screen — based on Figma S2 design (489:20881) */
export default function WeatherApp({ isActive }: AppProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dayStr = time.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dateStr = `${String(time.getDate()).padStart(2, '0')}-${String(time.getMonth() + 1).padStart(2, '0')}`;

  // Mock forecast data
  const forecast = [
    { day: 'MO', icon: '\u{2600}', high: 31, low: 26 },
    { day: 'TU', icon: '\u{26C5}', high: 29, low: 20 },
    { day: 'WE', icon: '\u{1F327}', high: 31, low: 22 },
  ];

  return (
    <div className="flex h-full w-full flex-col items-center bg-black px-[12%] py-[6%]">
      {/* Time */}
      <p className="text-[9.6vmin] font-semibold text-white leading-none">{timeStr}</p>

      {/* Day + Date */}
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-[6.4vmin] font-semibold text-[#ff8826]">{dayStr}</span>
        <span className="text-[6.4vmin] font-semibold text-white">{dateStr}</span>
      </div>

      {/* Current weather */}
      <div className="flex items-center mt-[4%] w-full">
        {/* Sun icon */}
        <div className="flex-shrink-0 text-[28vmin] leading-none">
          ☀️
        </div>
        <div className="flex flex-col items-start ml-auto">
          {/* Current temp */}
          <p className="text-[18vmin] font-semibold text-white leading-none">30°</p>
          {/* High / Low */}
          <div className="flex items-baseline gap-3">
            <span className="text-[9.6vmin] font-semibold text-[#eee9bf]">31°</span>
            <span className="text-[9.6vmin] font-semibold text-[#609cc4]">26°</span>
          </div>
        </div>
      </div>

      {/* 3-day forecast */}
      <div className="flex w-full justify-around mt-auto">
        {forecast.map((f) => (
          <div key={f.day} className="flex flex-col items-center gap-1">
            <span className="text-[6.4vmin] font-semibold text-[#6d6d6d]">{f.day}</span>
            <span className="text-[9.6vmin]">{f.icon}</span>
            <div className="flex gap-1">
              <span className="text-[4.8vmin] font-semibold text-white">{f.high}°</span>
              <span className="text-[4.8vmin] font-semibold text-[#eee9bf]">{f.low}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
