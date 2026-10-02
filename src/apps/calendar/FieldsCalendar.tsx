import { Calendar, CalendarX2, Moon } from 'lucide-react';
import type { CalendarEvent } from '../../api/types';
import {
  FieldsDisc, Headline, HeroGlyph, OutlineChip, Subline, TitleRow, type FieldsRoles,
} from '../../core/fields';
import { C, clip } from '../../core/fields-util';
import { calendarGlance } from './calendar-glance';
import { countdownLabel } from './calendar-utils';

// Calendar's resting screen in the Fields skin (src/shared/skins.ts), v2, the
// watchOS look: Figma SupeClock-Design, "4B v2 · Watch quality", Calendar V1.
// The feed carries no calendar colour or icon, so rows get a plain ink bar
// rather than an icon guessed from the title. Colour comes only from the
// --fields-calendar* roles, which flip for night in tokens.css.

const ROLES: FieldsRoles = {
  field: 'var(--fields-calendar)',
  ink: 'var(--fields-calendar-ink)',
  soft: 'var(--fields-calendar-ink-soft)',
  panel: 'var(--fields-calendar-panel)',
};
const INK = ROLES.ink;

function fmtTime(d: Date, timeFormat: '24h' | '12h'): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' });
}

/** "Thursday 1 October": the day this screen is about. */
function dayTitle(now: Date): string {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  return `${weekday} ${now.getDate()} ${month}`;
}

interface Row {
  key: string;
  title: string;
  time: string;
}

/** Up to two rows on the platter: later events, then all-day ones. */
function Rows({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <g>
      <rect x={190} y={664} width={700} height={rows.length * 120} rx={60} style={{ fill: ROLES.panel }} />
      {rows.map((r, i) => {
        const cy = 724 + i * 120;
        return (
          <g key={r.key}>
            <rect x={236} y={cy - 28} width={10} height={56} rx={5} style={{ fill: INK }} />
            <text x={266} y={cy} dominantBaseline="central" fontSize="40" fontWeight={800}
                  className="font-fields-num" style={{ fill: INK }}>
              {clip(r.title, 17)}
            </text>
            <text x={850} y={cy} textAnchor="end" dominantBaseline="central" fontSize="40" fontWeight={900}
                  className="font-fields-num" style={{ fill: INK }}>
              {r.time}
            </text>
            {i < rows.length - 1 && (
              <rect x={266} y={cy + 59} width={584} height={3} rx={1.5} opacity={0.2} style={{ fill: INK }} />
            )}
          </g>
        );
      })}
    </g>
  );
}

export interface FieldsCalendarProps {
  now: Date;
  events: CalendarEvent[];
  timeFormat: '24h' | '12h';
  offline: boolean;
  notConfigured: boolean;
  loading: boolean;
  page: number;
  pageCount: number;
}

export default function FieldsCalendar({
  now, events, timeFormat, offline, notConfigured, loading, page, pageCount,
}: FieldsCalendarProps) {
  const title = dayTitle(now);
  const header = (
    <TitleRow
      roles={ROLES}
      title={title}
      leadWidth={56}
      lead={(x0) => (
        <g style={{ color: INK }}>
          <Calendar x={x0} y={122} width={40} height={40} strokeWidth={2.6} />
        </g>
      )}
    />
  );
  const time = (iso: string) => fmtTime(new Date(iso), timeFormat);

  // Config state beats network state: a missing feed is actionable on the
  // server; "offline" is not (the old cover's honest tells, kept).
  if (notConfigured) {
    return (
      <FieldsDisc roles={ROLES} summary="No calendar yet. Add a calendar feed on the server." page={page} pageCount={pageCount}>
        {header}
        <HeroGlyph roles={ROLES}><CalendarX2 x={445} y={235} width={190} height={190} strokeWidth={2} /></HeroGlyph>
        <Headline roles={ROLES}>No calendar yet</Headline>
        <Subline roles={ROLES}>Add a calendar feed on the server</Subline>
      </FieldsDisc>
    );
  }

  // First load with nothing cached: the header alone, never "nothing on".
  if (loading && events.length === 0 && !offline) {
    return (
      <FieldsDisc roles={ROLES} summary={`${title}. Loading events.`} page={page} pageCount={pageCount}>
        {header}
      </FieldsDisc>
    );
  }

  const g = calendarGlance(events, now);
  const staleChip = offline ? <OutlineChip roles={ROLES} text="Offline · saved events" cy={614} /> : null;

  if (g.kind === 'done') {
    const line = g.tomorrow
      ? `Tomorrow · ${clip(g.tomorrow.title, 16)}${g.tomorrow.allDay ? '' : ` ${time(g.tomorrow.start)}`}`
      : g.allDay[0] ? `All day · ${clip(g.allDay[0].title, 18)}` : '';
    return (
      <FieldsDisc roles={ROLES} summary={`${title}. Nothing else today.${line ? ` ${line}.` : ''}`} page={page} pageCount={pageCount}>
        {header}
        <HeroGlyph roles={ROLES}><Moon x={445} y={235} width={190} height={190} strokeWidth={2} /></HeroGlyph>
        <Headline roles={ROLES}>Nothing else today</Headline>
        {line && <Subline roles={ROLES}>{line}</Subline>}
        {staleChip && <g transform="translate(0 60)">{staleChip}</g>}
      </FieldsDisc>
    );
  }

  const ev = g.event;
  const until = `until ${time(ev.end)}`;
  const detail = g.kind === 'now' ? until : [countdownLabel(new Date(ev.start), now), until].filter(Boolean).join(' · ');
  const rows: Row[] = [
    ...g.rest.map((e) => ({ key: e.uid, title: e.title, time: time(e.start) })),
    ...g.allDay.map((e) => ({ key: e.uid, title: e.title, time: 'All day' })),
  ].slice(0, 2);

  return (
    <FieldsDisc
      roles={ROLES}
      summary={`${title}. ${g.kind === 'now' ? 'Now' : 'Up next'}: ${ev.title} at ${time(ev.start)}, ${detail}.${offline ? ' Offline, showing saved events.' : ''}`}
      page={page}
      pageCount={pageCount}
    >
      {header}
      <text x={C} y={214} textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight={800}
            className="font-fields-num" style={{ fill: ROLES.soft }}>
        {g.kind === 'now' ? 'Now' : 'Up next'}
      </text>
      <text x={C} y={352} textAnchor="middle" dominantBaseline="central" fontSize="200" fontWeight={900}
            letterSpacing="-4" className="font-fields-num" style={{ fill: INK }}>
        {time(ev.start)}
      </text>
      <Headline roles={ROLES} y={534}>{clip(ev.title, 24)}</Headline>
      {staleChip ?? <Subline roles={ROLES} y={594}>{detail}</Subline>}
      <Rows rows={rows} />
    </FieldsDisc>
  );
}
