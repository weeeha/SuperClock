import { useState, useEffect, useMemo } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { fitnessAppSchema } from '../../shared/schemas/app.fitness';

type View = 'today' | 'week';

const STORAGE_KEY = 'superclock-fitness-days';
const LEGACY_KEY = 'superclock-fitness-count'; // pre-per-day single lifetime count

// LOCAL calendar date, not toISOString() (UTC) — same rationale as HabitsApp:
// mixing the two shifts day keys by one around midnight in any UTC+ timezone.
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadDays(): Record<string, number> {
  let days: Record<string, number> = {};
  try { days = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
  catch { days = {}; }

  // One-time migration: the old key held a single lifetime count — treat it as
  // today's reps once, then delete it so it can never re-migrate.
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy !== null) {
    const n = parseInt(legacy, 10);
    if (Number.isFinite(n) && n > 0) {
      const today = toDateStr(new Date());
      days[today] = Math.max(days[today] ?? 0, n);
    }
    localStorage.removeItem(LEGACY_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
  }
  return days;
}

// Consecutive days (ending today, or yesterday if today isn't done yet)
// on which the goal was actually met. Earned, not decorative.
function computeStreak(days: Record<string, number>, goal: number, now: Date): number {
  const d = new Date(now);
  if ((days[toDateStr(d)] ?? 0) < goal) d.setDate(d.getDate() - 1);
  let streak = 0;
  while ((days[toDateStr(d)] ?? 0) >= goal) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ── Today view ──────────────────────────────────────────────────────────────

function TodayView({
  reps,
  goal,
  exercise,
  streak,
}: {
  reps: number;
  goal: number;
  exercise: string;
  streak: number;
}) {
  const progress = Math.min(reps / goal, 1);
  const circumference = 2 * Math.PI * 460;
  const offset = circumference * (1 - progress);
  const dotCount = Math.min(streak, 7);

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      {/* Background fills viewBox so any over-scan stays cream */}
      <rect x="0" y="0" width="1000" height="1000" fill="#f5f0eb" />

      {/* Progress ring track */}
      <circle
        cx="500" cy="500" r="460"
        fill="none"
        stroke="#e0d8d0"
        strokeWidth="40"
      />

      {/* Progress ring fill — gradient from red to dark red */}
      <circle
        cx="500" cy="500" r="460"
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

      {/* Count vs goal */}
      <text x="500" y="380" textAnchor="middle" fill="#222" fontSize="120" fontWeight="800" fontFamily="Inter, sans-serif">
        {reps}
      </text>
      <text x="500" y="445" textAnchor="middle" fill="#999" fontSize="40" fontFamily="Inter, sans-serif">
        of {goal}
      </text>

      {/* Exercise emoji + configured label */}
      <text x="500" y="560" textAnchor="middle" fontSize="100">
        {'\u{1F4AA}'}
      </text>
      <text x="500" y="650" textAnchor="middle" fill="#666" fontSize="44" fontWeight="600" fontFamily="Inter, sans-serif">
        {exercise}
      </text>

      {/* Streak dots — one per consecutive goal-met day, capped at 7 */}
      {Array.from({ length: dotCount }, (_, i) => (
        <circle
          key={i}
          cx={500 + (i - (dotCount - 1) / 2) * 44}
          cy={720}
          r={14}
          fill="#e33030"
        />
      ))}
      {streak > 7 && (
        <text x="500" y="775" textAnchor="middle" fill="#999" fontSize="30" fontFamily="Inter, sans-serif">
          {streak} day streak
        </text>
      )}
    </svg>
  );
}

// ── Week view ───────────────────────────────────────────────────────────────

function WeekView({
  days,
  goal,
  now,
}: {
  days: Record<string, number>;
  goal: number;
  now: Date;
}) {
  const BAR_W = 56;
  const GAP = 28;
  const BASE_Y = 640;
  const MAX_H = 300;
  const startX = 500 - (7 * BAR_W + 6 * GAP) / 2;

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      <rect x="0" y="0" width="1000" height="1000" fill="#f5f0eb" />

      <text x="500" y="250" textAnchor="middle" fill="#666" fontSize="44" fontWeight="600" fontFamily="Inter, sans-serif">
        Last 7 days
      </text>

      {week.map((d, i) => {
        const reps = days[toDateStr(d)] ?? 0;
        const h = Math.max(Math.min(reps / goal, 1) * MAX_H, reps > 0 ? 16 : 0);
        const x = startX + i * (BAR_W + GAP);
        const isToday = i === 6;
        return (
          <g key={toDateStr(d)}>
            {/* Track */}
            <rect
              x={x} y={BASE_Y - MAX_H}
              width={BAR_W} height={MAX_H}
              rx={BAR_W / 2}
              fill="#e0d8d0"
            />
            {/* Fill vs dailyGoal */}
            {reps > 0 && (
              <rect
                x={x} y={BASE_Y - h}
                width={BAR_W} height={h}
                rx={Math.min(BAR_W / 2, h / 2)}
                fill={reps >= goal ? '#8b1a1a' : '#e33030'}
              />
            )}
            <text
              x={x + BAR_W / 2} y={BASE_Y - MAX_H - 24}
              textAnchor="middle" fill="#666"
              fontSize="30" fontFamily="Inter, sans-serif"
            >
              {reps}
            </text>
            <text
              x={x + BAR_W / 2} y={BASE_Y + 48}
              textAnchor="middle"
              fill={isToday ? '#222' : '#999'}
              fontSize="30"
              fontWeight={isToday ? '700' : '400'}
              fontFamily="Inter, sans-serif"
            >
              {d.toLocaleDateString('en-US', { weekday: 'short' })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Root component ──────────────────────────────────────────────────────────

/** Fitness/Gym screen — based on Figma S4 design (489:20936). Circular progress ring. */
export default function FitnessApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = fitnessAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : fitnessAppSchema.parse({});
  }, [config]);

  const [view, setView] = useState<View>('today');
  const [days, setDays] = useState<Record<string, number>>(loadDays);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  // Per-day keying means the count zeroes at local midnight on its own — this
  // minute-level tick (CalendarApp pattern) just rolls `now` so a kiosk left on
  // this screen overnight re-renders onto the new day's (empty) key.
  // cfg.resetAt: 'wake-time' and 'manual' currently behave as 'midnight' —
  // there is no wake signal or manual-reset control yet.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setNow((prev) => {
        const d = new Date();
        return toDateStr(d) === toDateStr(prev) ? prev : d;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [isActive]);

  // View switching consumes vertical swipes via the shell's callback slot
  // (same mechanism as HabitsApp's daily/monthly cycling).
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    const cb = (dir: 'up' | 'down') => {
      if (dir === 'up') {
        if (view === 'today') setView('week');
      } else if (view === 'week') {
        setView('today');
      } else {
        showGrid(); // swipe down at today = the shell's default gesture
      }
    };
    setVerticalSwipeCallback(cb);
    return () => {
      // popLayout keeps the exiting app mounted after the next app registers —
      // only clear the slot if it's still ours.
      if (useNavigation.getState().verticalSwipeCallback === cb) setVerticalSwipeCallback(null);
    };
  }, [isActive, view, setVerticalSwipeCallback, showGrid]);

  const todayReps = days[toDateStr(now)] ?? 0;
  const streak = computeStreak(days, cfg.dailyGoal, now);

  function handleTap() {
    const key = toDateStr(new Date());
    const next = { ...days, [key]: (days[key] ?? 0) + 1 };
    setDays(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#f5f0eb]"
      onClick={view === 'today' ? handleTap : undefined}
    >
      {view === 'today'
        ? <TodayView reps={todayReps} goal={cfg.dailyGoal} exercise={cfg.exercise} streak={streak} />
        : <WeekView days={days} goal={cfg.dailyGoal} now={now} />
      }
      <div className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'today' ? 'bg-black/70' : 'bg-black/20'}`} />
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'week' ? 'bg-black/70' : 'bg-black/20'}`} />
      </div>
    </div>
  );
}
