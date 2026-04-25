import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

/** Modern square clock face with rounded corners and minimal design */
export default function SquareClock({ isActive }: AppProps) {
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

  // Hour numbers at cardinal positions
  const hourLabels = [
    { num: 12, x: 500, y: 130 },
    { num: 3, x: 870, y: 515 },
    { num: 6, x: 500, y: 900 },
    { num: 9, x: 130, y: 515 },
  ];

  // Tick marks
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const isCardinal = i % 15 === 0;
    if (isCardinal) continue; // Skip where numbers are
    const angle = i * 6;
    ticks.push(
      <line
        key={i}
        x1="500"
        y1={isHour ? 70 : 85}
        x2="500"
        y2={isHour ? 115 : 105}
        stroke="white"
        strokeWidth={isHour ? 6 : 2}
        strokeLinecap="round"
        opacity={isHour ? 0.9 : 0.4}
        transform={`rotate(${angle} 500 500)`}
      />,
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* Square face with rounded corners */}
        <rect
          x="40"
          y="40"
          width="920"
          height="920"
          rx="80"
          ry="80"
          fill="#1a1a2e"
          stroke="white"
          strokeWidth="3"
          opacity="0.95"
        />

        {/* Inner border accent */}
        <rect
          x="65"
          y="65"
          width="870"
          height="870"
          rx="60"
          ry="60"
          fill="none"
          stroke="white"
          strokeWidth="1"
          opacity="0.15"
        />

        {/* Tick marks */}
        {ticks}

        {/* Hour numbers */}
        {hourLabels.map(({ num, x, y }) => (
          <text
            key={num}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize="72"
            fontWeight="300"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {num}
          </text>
        ))}

        {/* Hour hand */}
        <line
          x1="500"
          y1="500"
          x2="500"
          y2="250"
          stroke="white"
          strokeWidth="22"
          strokeLinecap="round"
          style={{ transform: `rotate(${hourDeg}deg)`, transformOrigin: '500px 500px' }}
        />

        {/* Minute hand */}
        <line
          x1="500"
          y1="500"
          x2="500"
          y2="140"
          stroke="white"
          strokeWidth="14"
          strokeLinecap="round"
          style={{ transform: `rotate(${minuteDeg}deg)`, transformOrigin: '500px 500px' }}
        />

        {/* Second hand */}
        <line
          x1="500"
          y1="570"
          x2="500"
          y2="160"
          stroke="#e94560"
          strokeWidth="4"
          strokeLinecap="round"
          style={{
            transform: `rotate(${secondDeg}deg)`,
            transformOrigin: '500px 500px',
            transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)',
          }}
        />

        {/* Center dot */}
        <circle cx="500" cy="500" r="10" fill="#e94560" />
        <circle cx="500" cy="500" r="4" fill="#1a1a2e" />
      </svg>
    </div>
  );
}
