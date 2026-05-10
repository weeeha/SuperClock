import { useState, useEffect, useRef } from 'react';
import type { AppProps } from '../../core/types';

/** Time Tracking — simple Pomodoro-style timer */
export default function TimeTrackingApp({ isActive }: AppProps) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [task] = useState('Focus');
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!isActive || !running) return;
    intervalRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isActive, running]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const progress = Math.min(elapsed / (25 * 60), 1); // 25 min Pomodoro
  const ringRadius = 485; // edge-to-edge, leaves room for 30px stroke
  const circumference = 2 * Math.PI * ringRadius;
  const offset = circumference * (1 - progress);

  function toggleTimer() {
    if (running) {
      setRunning(false);
    } else {
      setRunning(true);
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black" onClick={toggleTimer}>
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        {/* Progress ring — edge-to-edge */}
        <circle cx="500" cy="500" r={ringRadius} fill="none" stroke="#1a1a1a" strokeWidth="30" />
        <circle
          cx="500" cy="500" r={ringRadius}
          fill="none" stroke="#FF8826" strokeWidth="30" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '500px 500px', transition: 'stroke-dashoffset 1s linear' }}
        />

        {/* Timer text */}
        <text x="500" y="460" textAnchor="middle" fill="white" fontSize="160" fontWeight="600" fontFamily="Inter, sans-serif">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </text>

        {/* Task name */}
        <text x="500" y="560" textAnchor="middle" fill="#888" fontSize="48" fontFamily="Inter, sans-serif">
          {task}
        </text>

        {/* Status */}
        <text x="500" y="650" textAnchor="middle" fill={running ? '#22C55E' : '#666'} fontSize="36" fontFamily="Inter, sans-serif">
          {running ? 'TAP TO PAUSE' : elapsed > 0 ? 'TAP TO RESUME' : 'TAP TO START'}
        </text>
      </svg>
    </div>
  );
}
