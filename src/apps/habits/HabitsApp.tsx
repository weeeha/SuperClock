import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const defaultHabits: Habit[] = [
  { id: 'water', name: 'Water', icon: '💧', color: '#60A5FA' },
  { id: 'exercise', name: 'Exercise', icon: '🏃', color: '#E33030' },
  { id: 'reading', name: 'Reading', icon: '📖', color: '#22C55E' },
  { id: 'meditation', name: 'Meditate', icon: '🧘', color: '#A855F7' },
  { id: 'sleep', name: 'Sleep 8h', icon: '😴', color: '#3366FF' },
  { id: 'vitamins', name: 'Vitamins', icon: '💊', color: '#FF8826' },
];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Habits tracker — based on Figma S17 design (489:21156) */
export default function HabitsApp(_props: AppProps) {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const todayKey = getTodayKey();

  useEffect(() => {
    const saved = localStorage.getItem(`superclock-habits-${todayKey}`);
    if (saved) setCompleted(JSON.parse(saved));
  }, [todayKey]);

  function toggle(habitId: string) {
    const next = { ...completed, [habitId]: !completed[habitId] };
    setCompleted(next);
    localStorage.setItem(`superclock-habits-${todayKey}`, JSON.stringify(next));
  }

  const completedCount = defaultHabits.filter((h) => completed[h.id]).length;
  const progress = completedCount / defaultHabits.length;
  const circumference = 2 * Math.PI * 200;
  const offset = circumference * (1 - progress);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black gap-[3%] p-[6%]">
      {/* Progress ring with date */}
      <svg viewBox="0 0 500 500" className="w-[40%] flex-shrink-0">
        <circle cx="250" cy="250" r="200" fill="none" stroke="#222" strokeWidth="20" />
        <circle
          cx="250" cy="250" r="200"
          fill="none" stroke="#22C55E" strokeWidth="20" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '250px 250px', transition: 'stroke-dashoffset 0.5s' }}
        />
        <text x="250" y="240" textAnchor="middle" fill="white" fontSize="60" fontWeight="700" fontFamily="Inter, sans-serif">
          {completedCount}/{defaultHabits.length}
        </text>
        <text x="250" y="290" textAnchor="middle" fill="#888" fontSize="24" fontFamily="Inter, sans-serif">
          today
        </text>
      </svg>

      {/* Habit grid */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {defaultHabits.map((habit) => (
          <button
            key={habit.id}
            onClick={() => toggle(habit.id)}
            className="flex flex-col items-center gap-1 rounded-2xl p-3 transition-all"
            style={{
              background: completed[habit.id] ? habit.color + '33' : '#1a1a1a',
              border: completed[habit.id] ? `2px solid ${habit.color}` : '2px solid transparent',
            }}
          >
            <span className="text-[5vmin]">{habit.icon}</span>
            <span className="text-[2.5vmin] text-white/70">{habit.name}</span>
            {completed[habit.id] && <span className="text-[2.5vmin]">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
