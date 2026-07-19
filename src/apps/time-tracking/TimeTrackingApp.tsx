import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import { useRadar } from '../../core/radar';
import type { TimeTrackingAppConfig } from '../../shared/schemas/app.time-tracking';
import type { OccupancySummary } from '../../shared/occupancy';

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

/** Time Tracking — Pomodoro timer with radar auto-pause, plus the radar-fed
 *  "at desk today" total and hourly rhythm strip from /api/occupancy. */
export default function TimeTrackingApp({ isActive, config }: AppProps) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const [occupancy, setOccupancy] = useState<OccupancySummary | null>(null);

  const radar = useRadar();
  const radarLive = radar?.available === true;
  const present = radarLive ? radar.present === true : true;
  const { defaultProject = '', dailyTargetHours = 8 } =
    (config ?? {}) as Partial<TimeTrackingAppConfig>;
  const task = defaultProject || 'Focus';

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

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const progress = Math.min(elapsed / (25 * 60), 1); // 25 min Pomodoro
  const ringRadius = 485; // edge-to-edge, leaves room for 30px stroke
  const circumference = 2 * Math.PI * ringRadius;
  const offset = circumference * (1 - progress);

  function toggleTimer() {
    setAutoPaused(false);
    setRunning((r) => !r);
  }

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

  // Hourly rhythm strip: 24 bars, height ∝ at-desk time in that local hour.
  const maxHourMs = Math.max(1, ...(occupancy?.hourlyMs ?? [0]));
  const showOccupancy = occupancy !== null && (radarLive || occupancy.totalMs > 0);
  const deskLabel = occupancy
    ? `at desk today ${formatHours(occupancy.totalMs)} / ${dailyTargetHours}h`
    : '';

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

            {/* Hourly rhythm strip — today's at-desk time per hour */}
            {occupancy.hourlyMs.map((ms, hour) => {
              const barW = 14;
              const gap = 6;
              const x = 500 - (24 * (barW + gap) - gap) / 2 + hour * (barW + gap);
              const h = Math.max(4, (ms / maxHourMs) * 48);
              return (
                <rect
                  key={hour}
                  x={x}
                  y={776 - h}
                  width={barW}
                  height={h}
                  rx={2}
                  fill={ms > 0 ? '#FF8826' : '#2a2a2a'}
                  opacity={ms > 0 ? 0.45 + 0.55 * (ms / maxHourMs) : 1}
                />
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
}
