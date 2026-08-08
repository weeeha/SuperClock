import { useState, useEffect, useMemo } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { habitsAppSchema } from '../../shared/schemas/app.habits';

type View = 'daily' | 'monthly';

type Habit = { id: string; name: string; color: string };

const HABIT_COLORS = ['#FF3333', '#19A340', '#FF7012', '#0044FF', '#00B7FF', '#16DD73', '#FFD400'];

// Ids are lowercased names — identical to the ids the old hardcoded list used,
// so completions stored under STORAGE_KEY keep resolving after the move to
// config-driven habits. Colors assign by position (palette cycles past 7).
function habitsFromNames(names: string[]): Habit[] {
  const habits: Habit[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const id = name.trim().toLowerCase();
    if (!id || seen.has(id)) continue; // duplicate ids would collide in storage + React keys
    seen.add(id);
    habits.push({ id, name: name.trim(), color: HABIT_COLORS[habits.length % HABIT_COLORS.length] });
  }
  return habits;
}

const CX = 500;
const CY = 500;
const STORAGE_KEY = 'superclock-habits-v2';

// LOCAL calendar date, not toISOString() (UTC) — mixing the two shifted
// day keys by one around midnight in any UTC+ timezone, so a habit toggled
// today lit up the wrong cell in the monthly ring.
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  habits,
  completions,
  toggle,
  now,
}: {
  habits: Habit[];
  completions: Record<string, boolean>;
  toggle: (id: string) => void;
  now: Date;
}) {
  const todayStr = toDateStr(now);
  const day = now.getDate();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  const doneCount = habits.filter(h => completions[hKey(h.id, todayStr)]).length;
  const ORBIT = 310;
  const BTN_R = 88;

  return (
    <svg viewBox="0 0 1000 1000" className="w-full h-full">
      <defs>
        {habits.map(h => (
          <filter key={h.id} id={`gd-${h.id}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="18" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {habits.map((habit, i) => {
        const angle = (i / habits.length) * 360;
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
        fontSize="24" fontFamily="Inter, sans-serif">{doneCount}/{habits.length}</text>
    </svg>
  );
}

// ── Monthly view ─────────────────────────────────────────────────────────────

function MonthlyView({
  habits,
  completions,
  now,
}: {
  habits: Habit[];
  completions: Record<string, boolean>;
  now: Date;
}) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDays = daysInMonth(year, month);
  const todayDay = now.getDate();
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });

  // Rings spread evenly from RING_MIN to RING_MAX; at 7 habits this yields the
  // original hardcoded radii (140..368 step 38), and other counts still fit.
  const RING_MIN = 140;
  const RING_MAX = 368;
  const ringR = (hi: number) =>
    habits.length > 1 ? RING_MIN + (hi * (RING_MAX - RING_MIN)) / (habits.length - 1) : RING_MIN;
  const STROKE_W = 28;
  const SEG = 360 / totalDays;
  const GAP = 1.8;

  return (
    <svg viewBox="0 0 1000 1000" className="w-full h-full">
      <defs>
        {habits.map(h => (
          <filter key={h.id} id={`gm-${h.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {habits.map((habit, hi) => {
        const r = ringR(hi);
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
      {habits.map((h, i) => (
        <circle key={h.id} cx={CX - (habits.length - 1) * 15 + i * 30} cy={CY + 88} r={6} fill={h.color} />
      ))}
    </svg>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function HabitsApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = habitsAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : habitsAppSchema.parse({});
  }, [config]);
  const habits = useMemo(() => habitsFromNames(cfg.habits), [cfg.habits]);
  const [view, setView] = useState<View>('daily');
  const [completions, setCompletions] = useState<Record<string, boolean>>(loadCompletions);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  // Ticks at most once a day: same-date checks return the previous state,
  // so a kiosk left on this screen overnight rolls over to the new day
  // (the old frozen `now` kept checking yesterday's keys after midnight,
  // making taps look like no-ops).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setNow((prev) => {
        const d = new Date();
        return toDateStr(d) === toDateStr(prev) ? prev : d;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [isActive]);

  // View switching consumes vertical swipes via the shell's callback slot
  // (same mechanism as ClockApp's face cycling). The old touch-event
  // stopPropagation never reached the shell — it listens on the POINTER
  // channel with pointer capture — so a swipe both switched views AND
  // opened the app grid on top.
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    const cb = (dir: 'up' | 'down') => {
      if (dir === 'up') {
        if (view === 'daily') setView('monthly');
      } else if (view === 'monthly') {
        setView('daily');
      } else {
        showGrid(); // swipe down at daily = the shell's default gesture
      }
    };
    setVerticalSwipeCallback(cb);
    return () => {
      // popLayout keeps the exiting app mounted after the next app registers —
      // only clear the slot if it's still ours.
      if (useNavigation.getState().verticalSwipeCallback === cb) setVerticalSwipeCallback(null);
    };
  }, [isActive, view, setVerticalSwipeCallback, showGrid]);

  function toggle(habitId: string) {
    const key = hKey(habitId, toDateStr(new Date()));
    const next = { ...completions, [key]: !completions[key] };
    setCompletions(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {view === 'daily'
        ? <DailyView habits={habits} completions={completions} toggle={toggle} now={now} />
        : <MonthlyView habits={habits} completions={completions} now={now} />
      }
      <div className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'daily' ? 'bg-white' : 'bg-white/25'}`} />
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'monthly' ? 'bg-white' : 'bg-white/25'}`} />
      </div>
    </div>
  );
}
