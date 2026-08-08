import { MOOD_LABELS, type MoodGroup } from './sprites';

// Detail layer under the resting pet view (swipe up). Purely presentational —
// every value is computed by ClaudeUsageApp from the /api/claude-usage payload
// and the mood ring; nothing here invents metrics. Bars reuse the ClawdSprite
// pixel-display language: segmented cells etched with the panel grid stroke.

const CANVAS = 1000;
const CENTER = CANVAS / 2;
const PANEL_BG = '#0a0a09';
const CELL_BG = '#141413';
const CELL_STROKE = '#1c1c1a';
const TEXT_PRIMARY = '#f5f5f4';
const TEXT_MUTED = '#7d7872';

const SEGMENTS = 20; // matches the 20×20 sprite grid
const BAR_W = 560;
const BAR_H = 44;
const BAR_X = CENTER - BAR_W / 2;
const CELL_GAP = 6;
const CELL_W = (BAR_W - CELL_GAP * (SEGMENTS - 1)) / SEGMENTS;

const MONO = "'JetBrains Mono', ui-monospace, 'Menlo', monospace";
const SANS = 'Inter, system-ui, sans-serif';

interface Props {
  /** Same gate the resting view uses: payload present and ok === true. */
  showData: boolean;
  /** Non-null when offline — the resting view's banner text, shown verbatim. */
  offlineLabel: string | null;
  errorDetail: string | null;
  sessionFrac: number;
  weekFrac: number;
  sessionColor: string;
  weekColor: string;
  sessionReset: string;
  weekReset: string;
  ratePerMin: number | null;
  mood: MoodGroup;
  /** Daemon's last successful fetch (epoch ms); 0 = never. */
  fetchedAt: number;
}

function fmtSync(fetchedAt: number): string {
  if (!fetchedAt) return '—';
  const d = new Date(fetchedAt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ageMin = Math.floor(Math.max(0, Date.now() - fetchedAt) / 60_000);
  return ageMin < 1 ? `${hh}:${mm} · just now` : `${hh}:${mm} · ${ageMin}m ago`;
}

function SegmentBar({ y, frac, color, lit }: { y: number; frac: number; color: string; lit: boolean }) {
  const filled = lit ? Math.round(Math.max(0, Math.min(1, frac)) * SEGMENTS) : 0;
  return (
    <g>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <rect
          key={i}
          x={BAR_X + i * (CELL_W + CELL_GAP)}
          y={y}
          width={CELL_W}
          height={BAR_H}
          fill={i < filled ? color : CELL_BG}
          stroke={CELL_STROKE}
          strokeWidth={2}
        />
      ))}
    </g>
  );
}

export default function UsageDetailView({
  showData,
  offlineLabel,
  errorDetail,
  sessionFrac,
  weekFrac,
  sessionColor,
  weekColor,
  sessionReset,
  weekReset,
  ratePerMin,
  mood,
  fetchedAt,
}: Props) {
  const burn =
    showData && ratePerMin != null ? `${ratePerMin.toFixed(2)}%/min · ${MOOD_LABELS[mood]}` : '—';

  return (
    <svg
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      <rect x="0" y="0" width={CANVAS} height={CANVAS} fill={PANEL_BG} />

      <text x={CENTER} y={200} textAnchor="middle" fill={TEXT_MUTED} fontSize="34" fontFamily={MONO}>
        usage
      </text>

      {/* Session — 5h window */}
      <text x={BAR_X} y={306} fill={TEXT_MUTED} fontSize="30" fontFamily={MONO}>
        session
      </text>
      <text
        x={BAR_X + BAR_W} y={306} textAnchor="end"
        fill={TEXT_PRIMARY} fontSize="56" fontWeight="800" fontFamily={SANS}
      >
        {showData ? `${Math.round(sessionFrac * 100)}%` : '—'}
      </text>
      <SegmentBar y={326} frac={sessionFrac} color={sessionColor} lit={showData} />
      <text x={BAR_X} y={404} fill={TEXT_MUTED} fontSize="22" fontFamily={MONO}>
        {showData && sessionReset ? `resets ${sessionReset}` : ''}
      </text>

      {/* Week window */}
      <text x={BAR_X} y={496} fill={TEXT_MUTED} fontSize="30" fontFamily={MONO}>
        week
      </text>
      <text
        x={BAR_X + BAR_W} y={496} textAnchor="end"
        fill={TEXT_PRIMARY} fontSize="56" fontWeight="800" fontFamily={SANS}
      >
        {showData ? `${Math.round(weekFrac * 100)}%` : '—'}
      </text>
      <SegmentBar y={516} frac={weekFrac} color={weekColor} lit={showData} />
      <text x={BAR_X} y={594} fill={TEXT_MUTED} fontSize="22" fontFamily={MONO}>
        {showData && weekReset ? `resets ${weekReset}` : ''}
      </text>

      {/* Burn rate + mood (from the same ring buffer the sprite mood uses) */}
      <g fontFamily={MONO}>
        <text x={BAR_X} y={676} fill={TEXT_MUTED} fontSize="26">
          burn
        </text>
        <text x={BAR_X + BAR_W} y={676} textAnchor="end" fill={TEXT_PRIMARY} fontSize="30">
          {burn}
        </text>

        {/* Freshness — daemon's last successful fetch, even when now offline */}
        <text x={BAR_X} y={736} fill={TEXT_MUTED} fontSize="26">
          sync
        </text>
        <text x={BAR_X + BAR_W} y={736} textAnchor="end" fill={TEXT_MUTED} fontSize="26">
          {fmtSync(fetchedAt)}
        </text>
      </g>

      {/* Same honest offline tell as the resting view */}
      {offlineLabel && (
        <g fontFamily={MONO}>
          <text x={CENTER} y={812} textAnchor="middle" fill="#f5a623" fontSize="28">
            {offlineLabel}
          </text>
          {errorDetail && (
            <text x={CENTER} y={846} textAnchor="middle" fill={TEXT_MUTED} fontSize="18">
              {errorDetail}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
