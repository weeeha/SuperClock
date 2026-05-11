import { useState, useRef } from 'react';
import type { AppProps } from '../../core/types';

type View = 'daily' | 'monthly';

const HABITS = [
  { id: 'health',   name: 'Health',   color: '#FF3333' },
  { id: 'read',     name: 'Read',     color: '#19A340' },
  { id: 'fitness',  name: 'Fitness',  color: '#FF7012' },
  { id: 'code',     name: 'Code',     color: '#0044FF' },
  { id: 'water',    name: 'Water',    color: '#00B7FF' },
  { id: 'nature',   name: 'Nature',   color: '#16DD73' },
  { id: 'creative', name: 'Creative', color: '#FFD400' },
];

const CX = 500;
const CY = 500;
const STORAGE_KEY = 'superclock-habits-v2';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hKey(habitId: string, dateStr: string): string {
  return `${habitId}:${dateStr}`;
}

function loadCompletions(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
  catch { return {}; }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function polarToXY(r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function arcPath(r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polarToXY(r, startDeg);
  const [ex, ey] = polarToXY(r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${sx.toFixed(1)},${sy.toFixed(1)} A${r},${r} 0 ${large} 1 ${ex.toFixed(1)},${ey.toFixed(1)}`;
}

// ── Daily view ──────────────────────────────────────────────────────────────

function DailyView({
  completions,
  toggle,
  now,
}: {
  completions: Record<string, boolean>;
  toggle: (id: string) => void;
  now: Date;
}) {
  const todayStr = toDateStr(now);
  const day = now.getDate();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  const doneCount = HABITS.filter(h => completions[hKey(h.id, todayStr)]).length;
  const ORBIT = 310;
  const BTN_R = 88;

  return (
    <svg viewBox="0 0 1000 1000" className="w-full h-full">
      <defs>
        {HABITS.map(h => (
          <filter key={h.id} id={`gd-${h.id}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="18" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {HABITS.map((habit, i) => {
        const angle = (i / HABITS.length) * 360;
        const [bx, by] = polarToXY(ORBIT, angle);
        const done = !!completions[hKey(habit.id, todayStr)];
        return (
          <g key={habit.id} onClick={() => toggle(habit.id)} style={{ cursor: 'pointer' }}>
            <circle
              cx={bx} cy={by} r={BTN_R}
              fill={done ? habit.color : '#1c1c1c'}
              stroke={done ? habit.color : '#2e2e2e'}
              strokeWidth="3"
              filter={done ? `url(#gd-${habit.id})` : undefined}
            />
            <text
              x={bx} y={by}
              textAnchor="middle" dominantBaseline="middle"
              fill={done ? '#000' : '#666'}
              fontSize="30" fontFamily="Inter, sans-serif" fontWeight="600"
            >
              {habit.name}
            </text>
          </g>
        );
      })}

      {/* Center disc */}
      <circle cx={CX} cy={CY} r={168} fill="#0d0d0d" />
      <text x={CX} y={CY - 62} textAnchor="middle" fill="rgba(255,255,255,0.4)"
        fontSize="34" fontFamily="Inter, sans-serif">{weekday}</text>
      <text x={CX} y={CY + 28} textAnchor="middle" dominantBaseline="middle" fill="white"
        fontSize="90" fontFamily="Inter, sans-serif" fontWeight="700">{day}</text>
      <text x={CX} y={CY + 98} textAnchor="middle" fill="rgba(255,255,255,0.4)"
        fontSize="34" fontFamily="Inter, sans-serif">{month}</text>
      <text x={CX} y={CY + 138} textAnchor="middle" fill="rgba(255,255,255,0.25)"
        fontSize="24" fontFamily="Inter, sans-serif">{doneCount}/{HABITS.length}</text>
    </svg>
  );
}

// ── Monthly view ─────────────────────────────────────────────────────────────

function MonthlyView({
  completions,
  now,
}: {
  completions: Record<string, boolean>;
  now: Date;
}) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDays = daysInMonth(year, month);
  const todayDay = now.getDate();
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });

  const RING_RADII = [140, 178, 216, 254, 292, 330, 368];
  const STROKE_W = 28;
  const SEG = 360 / totalDays;
  const GAP = 1.8;

  return (
    <svg viewBox="0 0 1000 1000" className="w-full h-full">
      <defs>
        {HABITS.map(h => (
          <filter key={h.id} id={`gm-${h.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {HABITS.map((habit, hi) => {
        const r = RING_RADII[hi];
        return Array.from({ length: totalDays }, (_, d) => {
          const dayNum = d + 1;
          const dateStr = toDateStr(new Date(year, month, dayNum));
          const done = !!completions[hKey(habit.id, dateStr)];
          const isFuture = dayNum > todayDay;
          const startDeg = d * SEG + GAP / 2;
          const endDeg = (d + 1) * SEG - GAP / 2;
          const color = done ? habit.color : isFuture ? '#0d0d0d' : '#1e1e1e';
          return (
            <path
              key={`${hi}-${d}`}
              d={arcPath(r, startDeg, endDeg)}
              fill="none"
              stroke={color}
              strokeWidth={STROKE_W}
              strokeLinecap="round"
              filter={done ? `url(#gm-${habit.id})` : undefined}
            />
          );
        });
      })}

      {/* Center disc */}
      <circle cx={CX} cy={CY} r={118} fill="#090909" />
      <text x={CX} y={CY - 26} textAnchor="middle" fill="rgba(255,255,255,0.4)"
        fontSize="28" fontFamily="Inter, sans-serif">{monthName}</text>
      <text x={CX} y={CY + 30} textAnchor="middle" dominantBaseline="middle" fill="white"
        fontSize="72" fontFamily="Inter, sans-serif" fontWeight="700">{todayDay}</text>

      {/* Habit colour dots */}
      {HABITS.map((h, i) => (
        <circle key={h.id} cx={CX - 90 + i * 30} cy={CY + 88} r={6} fill={h.color} />
      ))}
    </svg>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function HabitsApp(_props: AppProps) {
  const [view, setView] = useState<View>('daily');
  const [completions, setCompletions] = useState<Record<string, boolean>>(loadCompletions);
  const touchStartY = useRef(0);
  const [now] = useState(() => new Date());

  function toggle(habitId: string) {
    const key = hKey(habitId, toDateStr(new Date()));
    const next = { ...completions, [key]: !completions[key] };
    setCompletions(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dy) > 50) {
      if (dy < 0 && view === 'daily') {
        setView('monthly');
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      } else if (dy > 0 && view === 'monthly') {
        setView('daily');
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }
    }
  }

  return (
    <div
      className="relative w-full h-full bg-black overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {view === 'daily'
        ? <DailyView completions={completions} toggle={toggle} now={now} />
        : <MonthlyView completions={completions} now={now} />
      }
      <div className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'daily' ? 'bg-white' : 'bg-white/25'}`} />
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'monthly' ? 'bg-white' : 'bg-white/25'}`} />
      </div>
    </div>
  );
}
