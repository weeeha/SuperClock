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
    weeks: { contributionDays: { contributionCount: number }[] }[];
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

  return { weeks, total: json.totalContributions, username: json.username };
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

/* ── Last-good cache ──────────────────────────────────────────
   When the proxy is unreachable (no token, GitHub down), we serve the
   last REAL graph we successfully fetched — never fabricated data. On a
   cold start with no cache, the component shows an honest empty state.
   Same "server is truth, localStorage is the resilience layer" pattern
   as src/shared/local-config.ts. */
const CACHE_KEY = 'superclock:github:contrib';

function loadCache(): ContributionData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContributionData;
    // Minimal shape guard — a corrupt/old entry must not crash the render.
    if (!Array.isArray(parsed.weeks) || typeof parsed.total !== 'number') return null;
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

/* ── Honest empty state ──────────────────────────────────────
   Shown only when there is no cached graph AND the fetch failed (no token
   configured, or GitHub unreachable on a cold start). A dim, contribution-
   shaped ring makes clear the face is alive but has no data to show — never
   fabricated numbers. */
function EmptyState() {
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
      </svg>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
export default function GithubApp({ isActive }: AppProps) {
  // Seed from the last-good cache so a prior real graph paints instantly on
  // boot; the network fetch below refreshes it. Never fabricated data.
  const [data, setData] = useState<ContributionData | null>(loadCache);
  const [error, setError] = useState<string | null>(null);

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
        setError(err instanceof Error ? err.message : String(err));
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
          setError(err instanceof Error ? err.message : String(err));
        });
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const stats = useMemo(() => (data ? computeStats(data.weeks) : null), [data]);

  // No data + a settled error → honest empty state (no token / cold start
  // offline). We never render fabricated contributions.
  if (!data || !stats) {
    if (error) return <EmptyState />;
    // Still loading the first fetch.
    return <div className="h-full w-full bg-black" />;
  }

  const cx = 500;
  const cy = 500;
  const innerR = 260;
  const outerR = 493;
  const dotR = 7;
  const totalWeeks = data.weeks.length;

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
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
