import { useState, useEffect, useMemo } from 'react';
import type { AppProps } from '../../core/types';

/* ── GitHub contribution levels & colors ─────────────────────── */
const COLORS = [
  '#161b22',   // 0 — no contributions
  '#0e4429',   // 1 — low
  '#006d32',   // 2 — medium
  '#26a641',   // 3 — high
  '#39d353',   // 4 — max
] as const;

type Level = 0 | 1 | 2 | 3 | 4;

interface ContributionData {
  weeks: Level[][];
  total: number;
  username: string;
}

interface Stats {
  average: string;
  most: number;
  currentStreak: number;
  longestStreak: number;
}

/* ── Fetch real GitHub contributions via GraphQL API ──────────── */
const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

const QUERY = `
query {
  viewer {
    login
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
  }
}`;

function countToLevel(count: number, max: number): Level {
  if (count === 0) return 0;
  const ratio = count / Math.max(max, 1);
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

async function fetchContributions(): Promise<ContributionData> {
  const token = import.meta.env.VITE_GITHUB_TOKEN;
  if (!token) throw new Error('No GitHub token configured');

  const res = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: QUERY }),
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

  const json = await res.json();
  const calendar = json.data.viewer.contributionsCollection.contributionCalendar;
  const username = json.data.viewer.login;

  // Find max contribution count for level scaling
  const allCounts: number[] = [];
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      allCounts.push(day.contributionCount);
    }
  }
  const maxCount = Math.max(...allCounts, 1);

  // Convert to Level[][] (exactly 52 weeks for the radial layout)
  const rawWeeks = calendar.weeks as { contributionDays: { contributionCount: number }[] }[];
  // Take the most recent 52 weeks
  const sliced = rawWeeks.slice(-52);
  const weeks: Level[][] = sliced.map((week) =>
    week.contributionDays.map((day) => countToLevel(day.contributionCount, maxCount)),
  );

  return { weeks, total: calendar.totalContributions, username };
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

/* ── Fallback mock data (if no token) ────────────────────────── */
function generateMockData(): ContributionData {
  const seed = new Date().getFullYear();
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 12345) & 0x7fffffff;
    return (s & 0xffff) / 0x10000;
  };

  const weeks: Level[][] = [];
  let total = 0;
  for (let w = 0; w < 52; w++) {
    const days: Level[] = [];
    const weekActivity = rand();
    for (let d = 0; d < 7; d++) {
      const r = rand();
      let level: Level;
      if (weekActivity < 0.2) {
        level = r < 0.7 ? 0 : r < 0.9 ? 1 : 2;
      } else if (weekActivity < 0.5) {
        level = r < 0.3 ? 0 : r < 0.6 ? 1 : r < 0.85 ? 2 : 3;
      } else {
        level = r < 0.1 ? 0 : r < 0.3 ? 1 : r < 0.55 ? 2 : r < 0.8 ? 3 : 4;
      }
      days.push(level);
      total += level;
    }
    weeks.push(days);
  }
  return { weeks, total, username: 'demo' };
}

/* ── Main Component ──────────────────────────────────────────── */
export default function GithubApp({ isActive }: AppProps) {
  const [data, setData] = useState<ContributionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = import.meta.env.VITE_GITHUB_TOKEN;
    if (!token) {
      setData(generateMockData());
      return;
    }

    fetchContributions()
      .then(setData)
      .catch((err) => {
        console.error('GitHub fetch failed, using mock data:', err);
        setError(err.message);
        setData(generateMockData());
      });
  }, []);

  // Refresh every 30 minutes when active
  useEffect(() => {
    if (!isActive || !import.meta.env.VITE_GITHUB_TOKEN) return;
    const id = setInterval(() => {
      fetchContributions().then(setData).catch(() => {});
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const stats = useMemo(() => (data ? computeStats(data.weeks) : null), [data]);

  if (!data || !stats) return <div className="h-full w-full bg-black" />;

  const cx = 500;
  const cy = 500;
  const innerR = 260;
  const outerR = 450;
  const dotR = 7;
  const totalWeeks = data.weeks.length;

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* Outer bezel ring */}
        <circle cx={cx} cy={cy} r={490} fill="none" stroke="#222" strokeWidth="4" />
        <circle cx={cx} cy={cy} r={470} fill="none" stroke="#1a1a1a" strokeWidth="2" />

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

        {/* Center dark disc */}
        <circle cx={cx} cy={cy} r={220} fill="#000" />
        <circle cx={cx} cy={cy} r={220} fill="none" stroke="#161b22" strokeWidth="1" />

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

        {/* Error indicator (subtle) */}
        {error && (
          <text
            x={cx} y={cy + 175}
            textAnchor="middle" fill="#6e7681"
            fontSize="12" fontFamily="'SF Mono', 'JetBrains Mono', monospace"
          >
            offline
          </text>
        )}
      </svg>
    </div>
  );
}
