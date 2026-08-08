import { useState, useEffect, useMemo } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { useRadar } from '../../core/radar';
import { timeTrackingAppSchema } from '../../shared/schemas/app.time-tracking';
import type { OccupancySummary } from '../../shared/occupancy';

type View = 0 | 1 | 2; // 0 focus timer, 1 task picker, 2 day summary

// Radar absence longer than this auto-pauses a running timer; returning
// auto-resumes it. The ring should only count time actually at the desk.
const AWAY_GRACE_MS = 45_000;
const OCCUPANCY_POLL_MS = 60_000;

function formatHours(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

// Local date, not Date.parse — 'YYYY-MM-DD' strings parse as UTC midnight,
// which lands on the previous day's weekday in any UTC+ timezone.
function weekdayLetter(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'narrow' });
}

// Hourly rhythm strip: 24 bars, height ∝ at-desk time in that local hour.
// Shared by the focus and summary views (same data, different placement).
function HourlyStrip({ hourlyMs, baseY, maxH }: { hourlyMs: number[]; baseY: number; maxH: number }) {
  const maxHourMs = Math.max(1, ...hourlyMs);
  const barW = 14;
  const gap = 6;
  return (
    <>
      {hourlyMs.map((ms, hour) => {
        const x = 500 - (24 * (barW + gap) - gap) / 2 + hour * (barW + gap);
        const h = Math.max(4, (ms / maxHourMs) * maxH);
        return (
          <rect
            key={hour}
            x={x}
            y={baseY - h}
            width={barW}
            height={h}
            rx={2}
            fill={ms > 0 ? '#FF8826' : '#2a2a2a'}
            opacity={ms > 0 ? 0.45 + 0.55 * (ms / maxHourMs) : 1}
          />
        );
      })}
    </>
  );
}

// ── Focus timer view ─────────────────────────────────────────────────────────

function FocusView({
  elapsed,
  running,
  autoPaused,
  task,
  occupancy,
  radarLive,
  present,
  dailyTargetHours,
  onToggle,
}: {
  elapsed: number;
  running: boolean;
  autoPaused: boolean;
  task: string;
  occupancy: OccupancySummary | null;
  radarLive: boolean;
  present: boolean;
  dailyTargetHours: number;
  onToggle: () => void;
}) {
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const progress = Math.min(elapsed / (25 * 60), 1); // 25 min Pomodoro
  const ringRadius = 485; // edge-to-edge, leaves room for 30px stroke
  const circumference = 2 * Math.PI * ringRadius;
  const offset = circumference * (1 - progress);

  let status: string;
  let statusColor: string;
  if (running) {
    status = 'TAP TO PAUSE';
    statusColor = '#22C55E';
  } else if (autoPaused) {
    status = 'PAUSED — AWAY FROM DESK';
    statusColor = '#EAB308';
  } else {
    status = elapsed > 0 ? 'TAP TO RESUME' : 'TAP TO START';
    statusColor = '#666';
  }

  const showOccupancy = occupancy !== null && (radarLive || occupancy.totalMs > 0);
  const deskLabel = occupancy
    ? `at desk today ${formatHours(occupancy.totalMs)} / ${dailyTargetHours}h`
    : '';

  return (
    <div className="h-full w-full" onClick={onToggle}>
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
        <text x="500" y="440" textAnchor="middle" fill="white" fontSize="160" fontWeight="600" fontFamily="Inter, sans-serif">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </text>

        {/* Task name */}
        <text x="500" y="540" textAnchor="middle" fill="#888" fontSize="48" fontFamily="Inter, sans-serif">
          {task}
        </text>

        {/* Status */}
        <text x="500" y="620" textAnchor="middle" fill={statusColor} fontSize="36" fontFamily="Inter, sans-serif">
          {status}
        </text>

        {showOccupancy && (
          <>
            {/* Radar-fed desk time vs daily target */}
            <text x="500" y="695" textAnchor="middle" fill="#aaa" fontSize="34" fontFamily="Inter, sans-serif">
              {radarLive && <tspan fill={present ? '#22C55E' : '#555'}>● </tspan>}
              {deskLabel}
            </text>

            <HourlyStrip hourlyMs={occupancy.hourlyMs} baseY={776} maxH={48} />
          </>
        )}
      </svg>
    </div>
  );
}

// ── Task picker view ─────────────────────────────────────────────────────────

function TaskPickerView({
  projects,
  activeTask,
  onPick,
}: {
  projects: string[];
  activeTask: string;
  onPick: (name: string) => void;
}) {
  const PILL_W = 620;
  const PILL_H = 116;
  const GAP = 34;
  const totalH = projects.length * PILL_H + (projects.length - 1) * GAP;
  const startY = 500 - totalH / 2;

  return (
    <svg viewBox="0 0 1000 1000" className="h-full w-full">
      <text x="500" y={startY - 60} textAnchor="middle" fill="#666" fontSize="34" fontFamily="Inter, sans-serif">
        TASK
      </text>
      {projects.map((name, i) => {
        const y = startY + i * (PILL_H + GAP);
        const active = name === activeTask;
        return (
          <g key={name} onClick={() => onPick(name)} style={{ cursor: 'pointer' }}>
            <rect
              x={500 - PILL_W / 2}
              y={y}
              width={PILL_W}
              height={PILL_H}
              rx={PILL_H / 2}
              fill={active ? '#FF8826' : '#1c1c1c'}
              stroke={active ? '#FF8826' : '#2e2e2e'}
              strokeWidth="3"
            />
            <text
              x="500"
              y={y + PILL_H / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={active ? '#000' : '#aaa'}
              fontSize="44"
              fontWeight="600"
              fontFamily="Inter, sans-serif"
            >
              {name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Day summary view ─────────────────────────────────────────────────────────

function SummaryView({
  occupancy,
  radarLive,
  present,
  dailyTargetHours,
}: {
  occupancy: OccupancySummary | null;
  radarLive: boolean;
  present: boolean;
  dailyTargetHours: number;
}) {
  // Honest offline: no summary without server data — never fake zeros as live.
  if (occupancy === null) {
    return (
      <svg viewBox="0 0 1000 1000" className="h-full w-full">
        <text x="500" y="500" textAnchor="middle" fill="#666" fontSize="36" fontFamily="Inter, sans-serif">
          occupancy data unavailable
        </text>
      </svg>
    );
  }

  // history arrives most recent first (incl. today) — reverse for oldest-left.
  const week = occupancy.history.slice(0, 7).reverse();
  const maxDayMs = Math.max(1, ...week.map((d) => d.totalMs));
  const DAY_W = 48;
  const DAY_GAP = 26;
  const weekLeft = 500 - (week.length * (DAY_W + DAY_GAP) - DAY_GAP) / 2;

  return (
    <svg viewBox="0 0 1000 1000" className="h-full w-full">
      <text x="500" y="255" textAnchor="middle" fill="#666" fontSize="34" fontFamily="Inter, sans-serif">
        {radarLive && <tspan fill={present ? '#22C55E' : '#555'}>● </tspan>}
        AT DESK TODAY
      </text>
      <text x="500" y="380" textAnchor="middle" fill="white" fontSize="120" fontWeight="600" fontFamily="Inter, sans-serif">
        {formatHours(occupancy.totalMs)}
      </text>
      <text x="500" y="445" textAnchor="middle" fill="#666" fontSize="34" fontFamily="Inter, sans-serif">
        of {dailyTargetHours}h target
      </text>

      <HourlyStrip hourlyMs={occupancy.hourlyMs} baseY={610} maxH={70} />

      {/* This week — one bar per day from the server's history */}
      {week.map((day, i) => {
        const x = weekLeft + i * (DAY_W + DAY_GAP);
        const h = Math.max(4, (day.totalMs / maxDayMs) * 90);
        const isToday = day.date === occupancy.date;
        return (
          <g key={day.date}>
            <rect
              x={x}
              y={790 - h}
              width={DAY_W}
              height={h}
              rx={4}
              fill={day.totalMs > 0 ? (isToday ? '#FF8826' : '#7a4a1e') : '#2a2a2a'}
            />
            <text
              x={x + DAY_W / 2}
              y="828"
              textAnchor="middle"
              fill={isToday ? '#aaa' : '#555'}
              fontSize="26"
              fontFamily="Inter, sans-serif"
            >
              {weekdayLetter(day.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Root component ───────────────────────────────────────────────────────────

/** Time Tracking — Pomodoro timer with radar auto-pause, plus the radar-fed
 *  "at desk today" total and hourly rhythm strip from /api/occupancy.
 *  Vertical swipe cycles focus timer → task picker → day summary. */
export default function TimeTrackingApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = timeTrackingAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : timeTrackingAppSchema.parse({});
  }, [config]);
  const [view, setView] = useState<View>(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancySummary | null>(null);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  const radar = useRadar();
  const radarLive = radar?.available === true;
  const present = radarLive ? radar.present === true : true;

  const projects = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of cfg.projects) {
      const name = raw.trim();
      if (!name || seen.has(name.toLowerCase())) continue; // duplicates would collide as React keys
      seen.add(name.toLowerCase());
      list.push(name);
    }
    // defaultProject stays the fallback when no projects are configured
    return list.length > 0 ? list : [cfg.defaultProject.trim() || 'Focus'];
  }, [cfg]);

  // A config push can remove the selected project — fall back to the first.
  const task = selectedTask !== null && projects.includes(selectedTask) ? selectedTask : projects[0];

  useEffect(() => {
    if (!isActive || !running) return;
    const timer = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isActive, running]);

  // Auto-pause after sustained absence; auto-resume shortly after return.
  // Only pauses we initiated resume themselves — a manual pause stays paused.
  useEffect(() => {
    if (!radarLive) return;
    let timer: number | null = null;
    if (running && !present) {
      timer = window.setTimeout(() => {
        setRunning(false);
        setAutoPaused(true);
      }, AWAY_GRACE_MS);
    } else if (!running && autoPaused && present) {
      timer = window.setTimeout(() => {
        setRunning(true);
        setAutoPaused(false);
      }, 500);
    }
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [radarLive, present, running, autoPaused]);

  // Poll the server's occupancy log while this screen is shown.
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/occupancy');
        if (!res.ok) return;
        const data = (await res.json()) as OccupancySummary;
        if (!cancelled) setOccupancy(data);
      } catch {
        // server unreachable — keep the last summary on screen
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), OCCUPANCY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isActive]);

  // View switching consumes vertical swipes via the shell's callback slot
  // (same mechanism as HabitsApp's daily/monthly toggle). Touch-event
  // stopPropagation never reaches the shell — it listens on the POINTER
  // channel with pointer capture — so this slot is the only way to keep a
  // swipe from also opening the app grid.
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    const cb = (dir: 'up' | 'down') => {
      if (dir === 'up') {
        if (view < 2) setView((view + 1) as View);
      } else if (view > 0) {
        setView((view - 1) as View);
      } else {
        showGrid(); // swipe down at focus timer = the shell's default gesture
      }
    };
    setVerticalSwipeCallback(cb);
    return () => {
      // popLayout keeps the exiting app mounted after the next app registers —
      // only clear the slot if it's still ours.
      if (useNavigation.getState().verticalSwipeCallback === cb) setVerticalSwipeCallback(null);
    };
  }, [isActive, view, setVerticalSwipeCallback, showGrid]);

  function toggleTimer() {
    setAutoPaused(false);
    setRunning((r) => !r);
  }

  function pickTask(name: string) {
    setSelectedTask(name);
    setView(0); // picking a task returns to the timer it now labels
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {view === 0 && (
        <FocusView
          elapsed={elapsed}
          running={running}
          autoPaused={autoPaused}
          task={task}
          occupancy={occupancy}
          radarLive={radarLive}
          present={present}
          dailyTargetHours={cfg.dailyTargetHours}
          onToggle={toggleTimer}
        />
      )}
      {view === 1 && <TaskPickerView projects={projects} activeTask={task} onPick={pickTask} />}
      {view === 2 && (
        <SummaryView
          occupancy={occupancy}
          radarLive={radarLive}
          present={present}
          dailyTargetHours={cfg.dailyTargetHours}
        />
      )}
      <div className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
        {([0, 1, 2] as const).map((v) => (
          <div
            key={v}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${view === v ? 'bg-white' : 'bg-white/25'}`}
          />
        ))}
      </div>
    </div>
  );
}
