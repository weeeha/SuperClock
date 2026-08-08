import { useState, useEffect, useMemo } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';

/* ── GitHub contribution levels & colors ─────────────────────── */
const COLORS = [
  '#161b22',   // 0 — no contributions
  '#0e4429',   // 1 — low
  '#006d32',   // 2 — medium
  '#26a641',   // 3 — high
  '#39d353',   // 4 — max
] as const;

type Level = 0 | 1 | 2 | 3 | 4;

type View = 'today' | 'ring';

interface DayCount {
  date: string;  // YYYY-MM-DD from the GitHub calendar
  count: number; // raw contribution count
}

interface ContributionData {
  weeks: Level[][];
  days: DayCount[]; // flat chronological raw counts (same 52-week window)
  maxCount: number; // year max, for count→level scaling
  total: number;
  username: string;
  fetchedAt: number; // epoch ms of the successful fetch (drives the offline pill)
}

interface Stats {
  average: string;
  most: number;
  currentStreak: number;
  longestStreak: number;
}

function countToLevel(count: number, max: number): Level {
  if (count === 0) return 0;
  const ratio = count / Math.max(max, 1);
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// Data comes via the server proxy (/api/github/contributions) — the PAT
// lives server-side only and never reaches this bundle.
async function fetchContributions(): Promise<ContributionData> {
  const res = await fetch('/api/github/contributions');
  const json = (await res.json()) as {
    ok: boolean;
    username: string;
    totalContributions: number;
    weeks: { contributionDays: { contributionCount: number; date: string }[] }[];
    error?: string;
  };
  if (!res.ok || !json.ok) throw new Error(json.error ?? `proxy HTTP ${res.status}`);

  // Find max contribution count for level scaling
  const allCounts: number[] = [];
  for (const week of json.weeks) {
    for (const day of week.contributionDays) {
      allCounts.push(day.contributionCount);
    }
  }
  const maxCount = Math.max(...allCounts, 1);

  // Convert to Level[][] — most recent 52 weeks for the radial layout
  const sliced = json.weeks.slice(-52);
  const weeks: Level[][] = sliced.map((week) =>
    week.contributionDays.map((day) => countToLevel(day.contributionCount, maxCount)),
  );
  // Keep the raw counts too — the Today view needs real numbers, not levels.
  const days: DayCount[] = sliced.flatMap((week) =>
    week.contributionDays.map((day) => ({ date: day.date, count: day.contributionCount })),
  );

  return {
    weeks,
    days,
    maxCount,
    total: json.totalContributions,
    username: json.username,
    fetchedAt: Date.now(),
  };
}

/* ── Compute stats from raw API data ─────────────────────────── */
function computeStats(weeks: Level[][]): Stats {
  const flat = weeks.flat();
  const nonZero = flat.filter((v) => v > 0);
  const avg = flat.length ? nonZero.reduce<number>((a, b) => a + b, 0) / flat.length : 0;

  const most = Math.max(...flat);

  // Streak: walk backwards from today
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  for (let i = flat.length - 1; i >= 0; i--) {
    if (flat[i] > 0) {
      streak++;
      if (i === flat.length - 1 || currentStreak === streak - 1) currentStreak = streak;
    } else {
      longestStreak = Math.max(longestStreak, streak);
      streak = 0;
    }
  }
  longestStreak = Math.max(longestStreak, streak);

  return { average: avg.toFixed(2), most, currentStreak, longestStreak };
}

/* ── Today & streak stats from raw counts ────────────────────── */
interface TodayStats {
  todayCount: number;
  currentStreak: number;
  longestStreak: number;
  last7: DayCount[]; // chronological, oldest first
}

function computeTodayStats(days: DayCount[]): TodayStats {
  const counts = days.map((d) => d.count);
  const todayCount = counts.length ? counts[counts.length - 1] : 0;

  // GitHub-style current streak: a zero TODAY doesn't break it yet — the day
  // isn't over. Anchor on the last non-zero-or-today position and walk back.
  let i = counts.length - 1;
  if (i >= 0 && counts[i] === 0) i--;
  let currentStreak = 0;
  for (; i >= 0 && counts[i] > 0; i--) currentStreak++;

  let longestStreak = 0;
  let run = 0;
  for (const c of counts) {
    run = c > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }

  return { todayCount, currentStreak, longestStreak, last7: days.slice(-7) };
}

/* ── Last-good cache ──────────────────────────────────────────
   When the proxy is unreachable (no token, GitHub down), we serve the
   last REAL graph we successfully fetched — dimmed, with an explicit
   "offline · cached <when>" pill so it is never mistaken for live data.
   On a cold start with no cache, the component shows an honest empty
   state. Same "server is truth, localStorage is the resilience layer"
   pattern as src/shared/local-config.ts. */
const CACHE_KEY = 'superclock:github:contrib';

function loadCache(): ContributionData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContributionData;
    // Minimal shape guard — a corrupt/pre-days-format entry must not crash
    // the render (old entries lacking days/fetchedAt are simply dropped).
    if (
      !Array.isArray(parsed.weeks) ||
      !Array.isArray(parsed.days) ||
      typeof parsed.total !== 'number' ||
      typeof parsed.maxCount !== 'number' ||
      typeof parsed.fetchedAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(data: ContributionData): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore — quota full, private mode, etc.
  }
}

function relativeTime(fromMs: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - fromMs) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── Honest empty state ──────────────────────────────────────
   Shown only when there is no cached graph AND the fetch failed (no token
   configured, or GitHub unreachable on a cold start). A dim, contribution-
   shaped ring makes clear the face is alive but has no data to show — never
   fabricated numbers. */
function EmptyState({ error }: { error: string }) {
  const cx = 500;
  const cy = 500;
  const innerR = 260;
  const outerR = 493;
  const dotR = 7;
  const weeks = 52;

  const dots = [];
  for (let w = 0; w < weeks; w++) {
    const angle = ((w / weeks) * 360 - 90) * (Math.PI / 180);
    for (let d = 0; d < 7; d++) {
      const r = innerR + (d / 6) * (outerR - innerR);
      dots.push(
        <circle
          key={`${w}-${d}`}
          cx={cx + r * Math.cos(angle)}
          cy={cy + r * Math.sin(angle)}
          r={dotR}
          fill={COLORS[0]}
          opacity={0.4}
        />,
      );
    }
  }

  // Surface the server's own hint when it applies — the 503 message names
  // GITHUB_TOKEN explicitly; anything else is generic unreachability.
  const hint = error.includes('GITHUB_TOKEN')
    ? 'set GITHUB_TOKEN on the server'
    : 'server unreachable';

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        {dots}
        <text
          x={cx} y={cy - 8}
          textAnchor="middle" fill="#8b949e"
          fontSize="34" fontWeight="600"
          fontFamily="'SF Mono', 'JetBrains Mono', monospace"
          letterSpacing="1"
        >
          GitHub
        </text>
        <text
          x={cx} y={cy + 34}
          textAnchor="middle" fill="#6e7681"
          fontSize="20" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
        >
          not connected
        </text>
        <text
          x={cx} y={cy + 68}
          textAnchor="middle" fill="#484f58"
          fontSize="16" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
        >
          {hint}
        </text>
      </svg>
    </div>
  );
}

/* ── View 0: Today & streak (resting view) ───────────────────── */
function TodayView({ data }: { data: ContributionData }) {
  const cx = 500;
  const { todayCount, currentStreak, longestStreak, last7 } = computeTodayStats(data.days);

  const DOT_SPACING = 74;
  const DOT_R = 20;
  const rowX0 = cx - ((last7.length - 1) * DOT_SPACING) / 2;

  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      {/* Today's contribution count — the glanceable number */}
      <text
        x={cx} y={270}
        textAnchor="middle" fill="#8b949e"
        fontSize="26" fontWeight="500"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
        letterSpacing="3"
      >
        TODAY
      </text>
      <text
        x={cx} y={470}
        textAnchor="middle" fill={todayCount > 0 ? '#39d353' : '#e6edf3'}
        fontSize="200" fontWeight="800"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        {todayCount}
      </text>
      <text
        x={cx} y={522}
        textAnchor="middle" fill="#6e7681"
        fontSize="22" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        contribution{todayCount === 1 ? '' : 's'}
      </text>

      {/* Last 7 days, oldest → today */}
      {last7.map((day, i) => (
        <circle
          key={day.date}
          cx={rowX0 + i * DOT_SPACING}
          cy={608}
          r={DOT_R}
          fill={COLORS[countToLevel(day.count, data.maxCount)]}
          stroke={i === last7.length - 1 ? '#8b949e' : 'none'}
          strokeWidth={i === last7.length - 1 ? 2 : 0}
          opacity={day.count === 0 ? 0.55 : 1}
        />
      ))}
      <text
        x={cx} y={662}
        textAnchor="middle" fill="#484f58"
        fontSize="16" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
        letterSpacing="1"
      >
        last 7 days
      </text>

      {/* Streaks */}
      <text
        x={cx - 110} y={772}
        textAnchor="middle" fill="#e6edf3"
        fontSize="64" fontWeight="700"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        {currentStreak}
      </text>
      <text
        x={cx + 110} y={772}
        textAnchor="middle" fill="#e6edf3"
        fontSize="64" fontWeight="700"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        {longestStreak}
      </text>
      <text
        x={cx - 110} y={806}
        textAnchor="middle" fill="#6e7681"
        fontSize="16" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        Current
      </text>
      <text
        x={cx + 110} y={806}
        textAnchor="middle" fill="#6e7681"
        fontSize="16" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        Longest
      </text>
    </svg>
  );
}

/* ── View 1: year ring (unchanged layout) ────────────────────── */
function RingView({ data, stats }: { data: ContributionData; stats: Stats }) {
  const cx = 500;
  const cy = 500;
  const innerR = 260;
  const outerR = 493;
  const dotR = 7;
  const totalWeeks = data.weeks.length;

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      {/* Radial contribution dots — each week is a spoke */}
      {data.weeks.map((days, weekIndex) => {
        const angle = ((weekIndex / totalWeeks) * 360 - 90) * (Math.PI / 180);

        return days.map((level, dayIndex) => {
          const r = innerR + (dayIndex / 6) * (outerR - innerR);
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);

          return (
            <circle
              key={`${weekIndex}-${dayIndex}`}
              cx={x}
              cy={y}
              r={dotR}
              fill={COLORS[level]}
              opacity={level === 0 ? 0.5 : 1}
            />
          );
        });
      })}

      {/* ── Center Stats ── */}

      {/* "Streak" header */}
      <text
        x={cx} y={cy - 105}
        textAnchor="middle" fill="#8b949e"
        fontSize="22" fontWeight="500"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
        letterSpacing="2"
      >
        STREAK
      </text>

      {/* Longest / Current labels */}
      <text
        x={cx - 60} y={cy - 78}
        textAnchor="middle" fill="#6e7681"
        fontSize="16" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        Longest
      </text>
      <text
        x={cx + 60} y={cy - 78}
        textAnchor="middle" fill="#6e7681"
        fontSize="16" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        Current
      </text>

      {/* Streak values */}
      <text
        x={cx - 60} y={cy - 46}
        textAnchor="middle" fill="#e6edf3"
        fontSize="48" fontWeight="700"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        {stats.longestStreak}
      </text>
      <text
        x={cx + 60} y={cy - 46}
        textAnchor="middle" fill="#e6edf3"
        fontSize="48" fontWeight="700"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        {stats.currentStreak}
      </text>

      {/* Total contributions — big number */}
      <text
        x={cx} y={cy + 30}
        textAnchor="middle" fill="#ffffff"
        fontSize="100" fontWeight="800"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        {data.total}
      </text>

      {/* Per Day values */}
      <text
        x={cx - 60} y={cy + 85}
        textAnchor="middle" fill="#39d353"
        fontSize="42" fontWeight="700"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        {stats.most}
      </text>
      <text
        x={cx + 60} y={cy + 85}
        textAnchor="middle" fill="#39d353"
        fontSize="42" fontWeight="700"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        {stats.average}
      </text>

      {/* Most / Average labels */}
      <text
        x={cx - 60} y={cy + 110}
        textAnchor="middle" fill="#6e7681"
        fontSize="16" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        Most
      </text>
      <text
        x={cx + 60} y={cy + 110}
        textAnchor="middle" fill="#6e7681"
        fontSize="16" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
      >
        Average
      </text>

      {/* "Per Day" label */}
      <text
        x={cx} y={cy + 140}
        textAnchor="middle" fill="#8b949e"
        fontSize="18" fontWeight="500"
        fontFamily="'SF Mono', 'JetBrains Mono', monospace"
        letterSpacing="1"
      >
        Per Day
      </text>
    </svg>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
export default function GithubApp({ isActive }: AppProps) {
  // Seed from the last-good cache so a prior real graph paints instantly on
  // boot; the network fetch below refreshes it. Never fabricated data.
  const [data, setData] = useState<ContributionData | null>(loadCache);
  // Error carries a timestamp so every failed refresh is a NEW object —
  // a repeated identical message string would bail out of re-render and
  // freeze the "cached <when>" pill.
  const [error, setError] = useState<{ message: string; at: number } | null>(null);
  const [view, setView] = useState<View>('today');
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  useEffect(() => {
    let cancelled = false;
    fetchContributions()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        saveCache(d);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Keep whatever cached graph we seeded; just show the offline tell.
        // If there's no cache, `data` stays null → honest empty state.
        console.error('GitHub fetch failed:', err);
        setError({ message: err instanceof Error ? err.message : String(err), at: Date.now() });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh every 30 minutes when active. Failures must SET the error state:
  // swallowing them here meant weeks-stale data with no offline tell.
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      fetchContributions()
        .then((d) => {
          setData(d);
          saveCache(d);
          setError(null);
        })
        .catch((err: unknown) => {
          setError({ message: err instanceof Error ? err.message : String(err), at: Date.now() });
        });
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [isActive]);

  // View switching consumes vertical swipes via the shell's callback slot —
  // same mechanism as HabitsApp/ClockApp (touch-event stopPropagation never
  // reaches the shell; it listens on the POINTER channel with capture).
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    const cb = (dir: 'up' | 'down') => {
      if (dir === 'up') {
        if (view === 'today') setView('ring');
      } else if (view === 'ring') {
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

  const stats = useMemo(() => (data ? computeStats(data.weeks) : null), [data]);

  // No data + a settled error → honest empty state (no token / cold start
  // offline). We never render fabricated contributions.
  if (!data || !stats) {
    if (error) return <EmptyState error={error.message} />;
    // Still loading the first fetch.
    return <div className="h-full w-full bg-black" />;
  }

  const offline = error !== null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Cached data is DIMMED + desaturated — never styled as live. */}
      <div className={`flex h-full w-full items-center justify-center ${offline ? 'opacity-40 saturate-50' : ''}`}>
        {view === 'today'
          ? <TodayView data={data} />
          : <RingView data={data} stats={stats} />
        }
      </div>

      {offline && (
        <div className="absolute top-[8%] left-1/2 -translate-x-1/2 rounded-full border border-[#30363d] bg-[#161b22] px-5 py-1.5 font-mono text-lg text-[#8b949e] pointer-events-none">
          offline &middot; cached {relativeTime(data.fetchedAt)}
        </div>
      )}

      <div className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'today' ? 'bg-white' : 'bg-white/25'}`} />
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'ring' ? 'bg-white' : 'bg-white/25'}`} />
      </div>
    </div>
  );
}
