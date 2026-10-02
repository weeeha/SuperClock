import { CalendarDays, CalendarPlus } from 'lucide-react';
import type { CountdownAppConfig } from '../../shared/schemas/app.countdown';
import {
  FieldsDisc, Headline, HeroGlyph, Subline, TitleRow, type FieldsRoles,
} from '../../core/fields';
import { C, clip } from '../../core/fields-util';
import { amount, countdownCopy } from './countdown-copy';
import { parseDate, type CountdownView } from './countdown-state';

// Countdown in the Fields skin (src/shared/skins.ts), v2, the watchOS look:
// Figma SupeClock-Design, "4B v2 · Watch quality", Countdown V1 (71:2, 71:19).
// The view model and copy rules are Countdown's own (countdown-state.ts,
// countdown-copy.ts); this file only draws them. Colour comes from the
// --fields-countdown* roles, which flip for night in tokens.css.

const ROLES: FieldsRoles = {
  field: 'var(--fields-countdown)',
  ink: 'var(--fields-countdown-ink)',
  soft: 'var(--fields-countdown-ink-soft)',
  // Countdown draws no platter; the disc stands in so the type stays total.
  panel: 'var(--fields-countdown)',
};
const INK = ROLES.ink;
const R = 488;
const CIRC = 2 * Math.PI * R;

/** "Saturday 24 October" for a 'YYYY-MM-DD' date. */
function longDate(s: string): string {
  const p = parseDate(s);
  if (!p) return '';
  const d = new Date(p.y, p.m - 1, p.d);
  return `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${p.d} ${d.toLocaleDateString('en-US', { month: 'long' })}`;
}

/** The rim ring: how much of the wait has passed. Spent = a full soft ring. */
function Ring({ fraction, spent }: { fraction: number; spent: boolean }) {
  return (
    <g>
      <circle cx={C} cy={C} r={R} fill="none" strokeWidth={36} opacity={spent ? 0.5 : 0.22} style={{ stroke: INK }} />
      {!spent && fraction > 0 && (
        <circle cx={C} cy={C} r={R} fill="none" strokeWidth={36} strokeLinecap="round"
                strokeDasharray={`${CIRC * Math.min(fraction, 1)} ${CIRC}`} transform={`rotate(-90 ${C} ${C})`}
                style={{ stroke: INK }} />
      )}
    </g>
  );
}

export interface FieldsCountdownProps {
  view: CountdownView;
  config: CountdownAppConfig;
}

export default function FieldsCountdown({ view, config }: FieldsCountdownProps) {
  const label = config.label.trim();
  const title = label ? clip(label, 22) : 'Countdown';
  const header = (
    <TitleRow
      roles={ROLES}
      title={title}
      leadWidth={56}
      lead={(x0) => (
        <g style={{ color: INK }}>
          <CalendarDays x={x0} y={122} width={40} height={40} strokeWidth={2.6} />
        </g>
      )}
    />
  );

  if (view.kind === 'not-set-up') {
    return (
      <FieldsDisc roles={ROLES} summary="Countdown is not set up. Set a date in the admin." page={0} pageCount={1}>
        {header}
        <HeroGlyph roles={ROLES}><CalendarPlus x={445} y={235} width={190} height={190} strokeWidth={2} /></HeroGlyph>
        <Headline roles={ROLES}>No date yet</Headline>
        <Subline roles={ROLES}>Set a date in the admin</Subline>
      </FieldsDisc>
    );
  }

  const copy = countdownCopy(view, config);
  const ring = view.ring && !('missingStart' in view.ring) ? view.ring : null;
  const date = longDate(config.targetDate);
  // The label already rides in the title row, so the day itself gets a sentence.
  const headline =
    view.kind === 'today' ? 'The day is here'
      : `${amount(view)} ${view.kind === 'until' ? 'to go' : 'since'}`;
  // After the date the number counts up in the soft ink (Countdown decision 1).
  const heroFill = copy.muted ? ROLES.soft : INK;
  const summary = `${title}: ${copy.headline} ${headline}. ${date}.${copy.caption ? ` ${copy.caption}.` : ''}`;

  return (
    <FieldsDisc roles={ROLES} summary={summary} page={0} pageCount={1}>
      {ring && <Ring fraction={ring.fraction} spent={ring.spent} />}
      {header}
      {view.kind === 'today' ? (
        <text x={C} y={340} textAnchor="middle" dominantBaseline="central" fontSize="200" fontWeight={900}
              letterSpacing="-4" className="font-fields-num" style={{ fill: heroFill }}>
          {copy.headline}
        </text>
      ) : (
        <text x={C} y={360} textAnchor="middle" dominantBaseline="central" fontSize="280" fontWeight={900}
              letterSpacing="-6" className="font-fields-num" style={{ fill: heroFill }}>
          {copy.headline}
        </text>
      )}
      <Headline roles={ROLES} y={548}>{headline}</Headline>
      {date && <Subline roles={ROLES} y={612}>{date}</Subline>}
      {copy.caption && (
        <text x={C} y={676} textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight={800}
              className="font-fields-num" style={{ fill: ROLES.soft }}>
          {copy.caption}
        </text>
      )}
    </FieldsDisc>
  );
}
