import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { MOOD_GROUPS, SPRITES, type Sprite } from './sprites';
import { useClaudeUsage } from './useClaudeUsage';
import { useMood } from './useMood';
import ClawdSprite from './ClawdSprite';
import UsageDetailView from './UsageDetailView';

type View = 'pet' | 'detail';

const SPRITE_ROTATE_MS = 20_000;
const CANVAS = 1000;
const CENTER = CANVAS / 2;
const R_SESSION = 460;
const R_WEEK = 400;
const STROKE_SESSION = 44;
const STROKE_WEEK = 30;

// Sprite panel (square, slightly above center per Figma layout).
const SPRITE_PX = 500;
const SPRITE_TOP = 175;
const METRIC_TOP = SPRITE_TOP + SPRITE_PX + 30; // y of the small label baseline

const TEXT_PRIMARY = '#f5f5f4';
const TEXT_MUTED = '#7d7872';

function statusColor(status: string, util: number): string {
  if (status === 'allowed_warning') return '#f5a623';
  if (status === 'blocked' || util >= 0.95) return '#e44a4a';
  if (util >= 0.75) return '#f5a623';
  return '#d18b75'; // coral, matches Figma
}

function arcPath(cx: number, cy: number, r: number, fraction: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  if (f <= 0) return '';
  const start = -Math.PI / 2;
  const end = start + f * Math.PI * 2;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = f > 0.5 ? 1 : 0;
  if (f >= 0.9999) {
    const xm = cx - r;
    return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${xm} ${cy} A ${r} ${r} 0 1 1 ${x1} ${y1}`;
  }
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function fmtCountdown(resetMs: number): string {
  if (!resetMs) return '';
  const sec = Math.max(0, Math.floor((resetMs - Date.now()) / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pickSpriteForMood(moodIdx: number, rotation: number): Sprite {
  const group = MOOD_GROUPS[moodIdx] ?? MOOD_GROUPS[0];
  const id = group[rotation % group.length];
  return SPRITES[id] ?? Object.values(SPRITES)[0];
}

export default function ClaudeUsageApp({ isActive }: AppProps) {
  const { data, loading } = useClaudeUsage(isActive);
  const sessionUtil = data?.session.utilization ?? 0;
  const weekUtil = data?.week.utilization ?? 0;
  const sessionPct = data ? sessionUtil * 100 : null;
  const { mood, ratePerMin } = useMood(sessionPct);

  const [view, setView] = useState<View>('pet');
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    if (!isActive || view !== 'pet') return; // sprite unmounted in detail view — don't tick
    const id = setInterval(() => setRotation((r) => r + 1), SPRITE_ROTATE_MS);
    return () => clearInterval(id);
  }, [isActive, view]);

  // Re-render countdowns each minute even if no new poll arrives.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isActive]);

  // View switching consumes vertical swipes via the shell's callback slot —
  // same registration/cleanup pattern as HabitsApp (pointer-channel shell
  // gestures can't be stopped from inside the app).
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    const cb = (dir: 'up' | 'down') => {
      if (dir === 'up') {
        if (view === 'pet') setView('detail');
      } else if (view === 'detail') {
        setView('pet');
      } else {
        showGrid(); // swipe down at the resting view = the shell's default gesture
      }
    };
    setVerticalSwipeCallback(cb);
    return () => {
      // popLayout keeps the exiting app mounted after the next app registers —
      // only clear the slot if it's still ours.
      if (useNavigation.getState().verticalSwipeCallback === cb) setVerticalSwipeCallback(null);
    };
  }, [isActive, view, setVerticalSwipeCallback, showGrid]);

  const sprite = useMemo(() => pickSpriteForMood(mood, rotation), [mood, rotation]);

  const sessionColor = statusColor(data?.session.status ?? 'unknown', sessionUtil);
  const weekColor = '#7ea876';

  const sessionFrac = Math.min(1, sessionUtil);
  const weekFrac = Math.min(1, weekUtil);

  const errorState = !loading && data && !data.ok;
  const hasNoData = !loading && !data;
  const showData = data?.ok === true;

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#0a0a09]">
      {view === 'pet' ? (
      <svg
        viewBox={`0 0 ${CANVAS} ${CANVAS}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <rect x="0" y="0" width={CANVAS} height={CANVAS} fill="#0a0a09" />

        {/* Session arc — outer */}
        <circle
          cx={CENTER} cy={CENTER} r={R_SESSION}
          fill="none" stroke="#141413" strokeWidth={STROKE_SESSION}
        />
        <path
          d={arcPath(CENTER, CENTER, R_SESSION, sessionFrac)}
          fill="none"
          stroke={sessionColor}
          strokeWidth={STROKE_SESSION}
          strokeLinecap="round"
        />

        {/* Week arc — inner */}
        <circle
          cx={CENTER} cy={CENTER} r={R_WEEK}
          fill="none" stroke="#141413" strokeWidth={STROKE_WEEK}
        />
        <path
          d={arcPath(CENTER, CENTER, R_WEEK, weekFrac)}
          fill="none"
          stroke={weekColor}
          strokeWidth={STROKE_WEEK}
          strokeLinecap="round"
        />

        {/* Sprite panel — mounted via foreignObject so canvas renders at native res */}
        <foreignObject
          x={CENTER - SPRITE_PX / 2}
          y={SPRITE_TOP}
          width={SPRITE_PX}
          height={SPRITE_PX}
        >
          <div style={{ width: SPRITE_PX, height: SPRITE_PX }}>
            <ClawdSprite sprite={sprite} size={SPRITE_PX} isActive={isActive} />
          </div>
        </foreignObject>

        {/* Metrics row directly below the sprite panel.
            Layout per Figma 651:25900: lowercase mono labels, big white percentages,
            tiny reset countdowns underneath. */}
        <g fontFamily="'JetBrains Mono', ui-monospace, 'Menlo', monospace">
          <text x={CENTER - 130} y={METRIC_TOP} textAnchor="middle" fill={TEXT_MUTED} fontSize="36">
            session
          </text>
          <text x={CENTER + 130} y={METRIC_TOP} textAnchor="middle" fill={TEXT_MUTED} fontSize="36">
            week
          </text>
        </g>
        <g fontFamily="Inter, system-ui, sans-serif" fontWeight="800">
          <text
            x={CENTER - 130}
            y={METRIC_TOP + 80}
            textAnchor="middle"
            fill={TEXT_PRIMARY}
            fontSize="92"
          >
            {showData ? `${Math.round(sessionUtil * 100)}%` : '—'}
          </text>
          <text
            x={CENTER + 130}
            y={METRIC_TOP + 80}
            textAnchor="middle"
            fill={TEXT_PRIMARY}
            fontSize="92"
          >
            {showData ? `${Math.round(weekUtil * 100)}%` : '—'}
          </text>
        </g>
        <g
          fontFamily="'JetBrains Mono', ui-monospace, 'Menlo', monospace"
          fill={TEXT_MUTED}
          fontSize="22"
        >
          <text x={CENTER - 130} y={METRIC_TOP + 120} textAnchor="middle">
            {showData ? fmtCountdown(data.session.resetAt) : ''}
          </text>
          <text x={CENTER + 130} y={METRIC_TOP + 120} textAnchor="middle">
            {showData ? fmtCountdown(data.week.resetAt) : ''}
          </text>
        </g>

        {/* Error / empty banner — sits over the lower arc area when there's no data */}
        {(errorState || hasNoData) && (
          <g fontFamily="'JetBrains Mono', ui-monospace, 'Menlo', monospace">
            <text x={CENTER} y={METRIC_TOP + 200} textAnchor="middle" fill="#f5a623" fontSize="28">
              {hasNoData ? 'no data' : 'auth expired — open claude code'}
            </text>
            {errorState && data?.error && (
              <text x={CENTER} y={METRIC_TOP + 234} textAnchor="middle" fill={TEXT_MUTED} fontSize="18">
                {data.error}
              </text>
            )}
          </g>
        )}
      </svg>
      ) : (
        <UsageDetailView
          showData={showData}
          offlineLabel={hasNoData ? 'no data' : errorState ? 'auth expired — open claude code' : null}
          errorDetail={(errorState && data?.error) || null}
          sessionFrac={sessionFrac}
          weekFrac={weekFrac}
          sessionColor={sessionColor}
          weekColor={weekColor}
          sessionReset={showData ? fmtCountdown(data.session.resetAt) : ''}
          weekReset={showData ? fmtCountdown(data.week.resetAt) : ''}
          ratePerMin={ratePerMin}
          mood={mood}
          fetchedAt={data?.fetchedAt ?? 0}
        />
      )}

      {/* View indicator dots — same affordance as HabitsApp */}
      <div className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'pet' ? 'bg-white' : 'bg-white/25'}`} />
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'detail' ? 'bg-white' : 'bg-white/25'}`} />
      </div>
    </div>
  );
}
