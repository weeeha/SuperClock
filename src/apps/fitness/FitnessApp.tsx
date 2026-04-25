import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

/** Fitness/Gym screen — based on Figma S4 design (489:20936). Circular progress ring. */
export default function FitnessApp(_props: AppProps) {
  const [count, setCount] = useState(33);

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('superclock-fitness-count');
    if (saved) setCount(parseInt(saved, 10));
  }, []);

  const goal = 50;
  const progress = Math.min(count / goal, 1);
  const circumference = 2 * Math.PI * 420;
  const offset = circumference * (1 - progress);

  function handleTap() {
    const next = count + 1;
    setCount(next);
    localStorage.setItem('superclock-fitness-count', String(next));
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center bg-black"
      onClick={handleTap}
    >
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* Background circle */}
        <circle cx="500" cy="500" r="460" fill="#f5f0eb" />

        {/* Progress ring track */}
        <circle
          cx="500" cy="500" r="420"
          fill="none"
          stroke="#e0d8d0"
          strokeWidth="40"
        />

        {/* Progress ring fill — gradient from red to dark red */}
        <circle
          cx="500" cy="500" r="420"
          fill="none"
          stroke="url(#fitnessGradient)"
          strokeWidth="40"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '500px 500px',
            transition: 'stroke-dashoffset 0.5s ease',
          }}
        />

        <defs>
          <linearGradient id="fitnessGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e33030" />
            <stop offset="100%" stopColor="#8b1a1a" />
          </linearGradient>
        </defs>

        {/* Count */}
        <text x="500" y="380" textAnchor="middle" fill="#222" fontSize="120" fontWeight="800" fontFamily="Inter, sans-serif">
          {count}
        </text>

        {/* Exercise emoji */}
        <text x="500" y="560" textAnchor="middle" fontSize="100">
          💪
        </text>

        {/* Hearts */}
        <text x="500" y="720" textAnchor="middle" fontSize="60">
          ❤️❤️❤️
        </text>
      </svg>
    </div>
  );
}
