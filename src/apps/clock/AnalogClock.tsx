import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

/** Swiss railway-style analog clock — based on Figma S10 design (489:21023) */
export default function AnalogClock({ isActive }: AppProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourDeg = hours * 30 + minutes * 0.5;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const secondDeg = seconds * 6;

  // Generate tick marks
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const angle = i * 6;
    ticks.push(
      <line
        key={i}
        x1="500"
        y1={isHour ? 20 : 40}
        x2="500"
        y2={isHour ? 80 : 65}
        stroke="currentColor"
        strokeWidth={isHour ? 12 : 4}
        strokeLinecap="round"
        transform={`rotate(${angle} 500 500)`}
      />,
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* Clock face */}
        <circle cx="500" cy="500" r="500" fill="#000000" />

        {/* Tick marks */}
        <g className="text-white">{ticks}</g>

        {/* Hour hand */}
        <line
          x1="500"
          y1="500"
          x2="500"
          y2="220"
          stroke="white"
          strokeWidth="28"
          strokeLinecap="round"
          style={{ transform: `rotate(${hourDeg}deg)`, transformOrigin: '500px 500px' }}
        />

        {/* Minute hand */}
        <line
          x1="500"
          y1="500"
          x2="500"
          y2="120"
          stroke="white"
          strokeWidth="20"
          strokeLinecap="round"
          style={{ transform: `rotate(${minuteDeg}deg)`, transformOrigin: '500px 500px' }}
        />

        {/* Second hand */}
        <line
          x1="500"
          y1="580"
          x2="500"
          y2="150"
          stroke="#FFD700"
          strokeWidth="6"
          strokeLinecap="round"
          style={{
            transform: `rotate(${secondDeg}deg)`,
            transformOrigin: '500px 500px',
            transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)',
          }}
        />

        {/* Center dot */}
        <circle cx="500" cy="500" r="12" fill="#FFD700" />
        <circle cx="500" cy="500" r="6" fill="#000000" />
      </svg>
    </div>
  );
}
