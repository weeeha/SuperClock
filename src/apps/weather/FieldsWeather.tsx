import type { ReactNode } from 'react';
import { CloudSun, Droplet, MapPin, Sun, Thermometer, WifiOff, Wind } from 'lucide-react';
import {
  FieldsDisc, Headline, HeroGlyph, OutlineChip, Subline, TitleRow, type FieldsRoles,
} from '../../core/fields';
import { C, useTextWidth } from '../../core/fields-util';
import ConditionMark, { type MarkPalette } from './ConditionMark';
import { codeMark, type WeatherModel } from './weather-utils';
import { rainPhrase } from './rain-phrase';
import { fieldsMetric, hoursFromNow, type FieldsChart, type MetricPage } from './fields-metric';

// Weather's Now screen in the Fields skin (src/shared/skins.ts), v2: the
// watchOS look Nick asked for on 2026-10-02 ("icons, bolder font, Apple Watch
// apps as the quality reference"). Geometry is the 1080 design frame from
// Figma (SupeClock-Design, "4B v2 · Watch quality", Weather V1 63:5), drawn
// 1:1 in a 1080 viewBox. Colour comes only from the --fields-weather* roles in
// tokens.css, which flip for night there: no night branch here.

const ROLES: FieldsRoles = {
  field: 'var(--fields-weather)',
  ink: 'var(--fields-weather-ink)',
  soft: 'var(--fields-weather-ink-soft)',
  panel: 'var(--fields-weather-panel)',
};
const INK = ROLES.ink;
const PANEL = ROLES.panel;
const MARKS: MarkPalette = {
  cloud: INK,
  sun: 'var(--fields-weather-sun)',
  drop: 'var(--fields-weather-drop)',
};
/** Now plus the next five hours, in six 120 px columns centred from x 240. */
const HOURS_SHOWN = 6;
/** Below this the hour column leaves the rain chance out, as watchOS does. */
const SHOW_PRECIP_FROM = 30;
/** A stale value stays readable as large text (3:1) in both modes. */
const STALE_OPACITY = 0.7;

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** A condition mark scaled from its 48-unit box, centred at (cx, cy). */
function Mark({ code, isDay, cx, cy, size }: { code: number; isDay: boolean; cx: number; cy: number; size: number }) {
  const id = codeMark(code, isDay);
  return (
    <g data-mark={id} transform={`translate(${cx} ${cy}) scale(${size / 48})`}>
      <ConditionMark id={id} palette={MARKS} />
    </g>
  );
}

/** Location row: a filled arrow and the place. With no place name
 *  (coordinates, or not set up) the arrow is left out. */
function Header({ title, located }: { title: string; located: boolean }) {
  return (
    <TitleRow
      roles={ROLES}
      title={title}
      leadWidth={located ? 42 : 0}
      lead={located ? (x0) => (
        <path d={`M ${x0} ${136} L ${x0 + 30} ${124} L ${x0 + 18} ${154} L ${x0 + 15} ${139} Z`}
              style={{ fill: INK }} />
      ) : undefined}
    />
  );
}

/** The hero: the condition mark beside the temperature, centred as a pair. */
function Hero({ model }: { model: WeatherModel }) {
  const text = `${model.current.temp}°`;
  const [ref, width] = useTextWidth(text);
  const x0 = C - (190 + 20 + width) / 2;
  return (
    <g opacity={width > 0 ? 1 : 0}>
      <Mark code={model.current.code} isDay={model.current.isDay} cx={x0 + 95} cy={330} size={190} />
      <text ref={ref} x={x0 + 210} y={367} dominantBaseline="central" fontSize="280" fontWeight={900}
            letterSpacing="-8.4" className="font-fields-num" style={{ fill: INK }}>
        {text}
      </text>
    </g>
  );
}

/** The change line ("Rain from 15:00") with a drop, centred as a pair. */
function ChangeLine({ text }: { text: string }) {
  const [ref, width] = useTextWidth(text);
  const x0 = C - (26 + 12 + width) / 2;
  const cx = x0 + 13;
  const top = 608;
  return (
    <g opacity={width > 0 ? 1 : 0}>
      <path
        d={`M ${cx} ${top} C ${cx + 4} ${top + 9} ${cx + 13} ${top + 16} ${cx + 13} ${top + 25} C ${cx + 13} ${top + 33} ${cx + 7} ${top + 38} ${cx} ${top + 38} C ${cx - 7} ${top + 38} ${cx - 13} ${top + 33} ${cx - 13} ${top + 25} C ${cx - 13} ${top + 16} ${cx - 4} ${top + 9} ${cx} ${top} Z`}
        style={{ fill: MARKS.drop }}
      />
      <text ref={ref} x={x0 + 38} y={627} dominantBaseline="central" fontSize="34" fontWeight={800}
            className="font-fields-num" style={{ fill: INK }}>
        {text}
      </text>
    </g>
  );
}

/** Now and the next five hours: hour, mark, temperature, and the rain chance
 *  when it matters. Everything on the panel uses the full ink (the soft ink
 *  reads 3.6:1 there). */
function HourlyPanel({ model }: { model: WeatherModel }) {
  const hours = hoursFromNow(model, HOURS_SHOWN);
  // The panel hugs its rows: without a rain-chance row it ends below the temps.
  const withPrecip = hours.some((h) => h.precipProb >= SHOW_PRECIP_FROM);
  return (
    <g>
      <rect x={180} y={672} width={720} height={withPrecip ? 250 : 212} rx={64} style={{ fill: PANEL }} />
      {hours.map((h, i) => {
        const cx = 240 + 120 * i;
        return (
          <g key={h.hour}>
            <text x={cx} y={709} textAnchor="middle" dominantBaseline="central" fontSize="28"
                  fontWeight={i === 0 ? 900 : 800} className="font-fields-num" style={{ fill: INK }}>
              {i === 0 ? 'Now' : String(h.hour).padStart(2, '0')}
            </text>
            <Mark code={h.code} isDay={h.isDay} cx={cx} cy={768} size={64} />
            <text x={cx} y={831} textAnchor="middle" dominantBaseline="central" fontSize="36"
                  fontWeight={900} className="font-fields-num" style={{ fill: INK }}>
              {h.temp}°
            </text>
            {h.precipProb >= SHOW_PRECIP_FROM && (
              <text x={cx} y={872} textAnchor="middle" dominantBaseline="central" fontSize="24"
                    fontWeight={800} className="font-fields-num" style={{ fill: INK }}>
                {h.precipProb}%
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export interface FieldsWeatherProps {
  model: WeatherModel | null;
  label: string;
  offline: boolean;
  updatedAt: Date | null;
  unconfigured: boolean;
  page: number;
  pageCount: number;
}

export default function FieldsWeather({ model, label, offline, updatedAt, unconfigured, page, pageCount }: FieldsWeatherProps) {
  const located = !unconfigured && label !== '';
  const title = located ? label : 'Weather';
  let body: ReactNode;
  let summary: string;

  if (unconfigured) {
    summary = 'Weather is not set up. Set a location in the admin.';
    body = (
      <>
        <HeroGlyph roles={ROLES}><MapPin x={445} y={235} width={190} height={190} strokeWidth={2} /></HeroGlyph>
        <Headline roles={ROLES}>Pick a place</Headline>
        <Subline roles={ROLES}>Set a location in the admin</Subline>
      </>
    );
  } else if (!model && offline) {
    summary = 'No weather yet. The forecast cannot be reached.';
    body = (
      <>
        <HeroGlyph roles={ROLES}><WifiOff x={445} y={235} width={190} height={190} strokeWidth={2} /></HeroGlyph>
        <Headline roles={ROLES}>No weather yet</Headline>
        <Subline roles={ROLES}>Can’t reach the forecast</Subline>
      </>
    );
  } else if (!model) {
    // Loading: the header alone. Nothing is drawn that the fetch has not said.
    summary = 'Loading the forecast.';
    body = null;
  } else {
    const { condition, change } = rainPhrase(model);
    const stale = offline && updatedAt !== null;
    summary =
      `${title}: ${model.current.temp} degrees, ${condition}.` +
      (change ? ` ${change}.` : '') +
      (stale && updatedAt ? ` Offline since ${hhmm(updatedAt)}.` : '');
    body = (
      <>
        <g opacity={stale ? STALE_OPACITY : 1}>
          <Hero model={model} />
        </g>
        <Headline roles={ROLES}>{condition}</Headline>
        <Subline roles={ROLES}>{`H:${model.today.high}°   L:${model.today.low}°`}</Subline>
        {stale && updatedAt
          ? <OutlineChip roles={ROLES} text={`Offline since ${hhmm(updatedAt)}`} />
          : change && <ChangeLine text={change} />}
        <g opacity={stale ? STALE_OPACITY : 1}>
          <HourlyPanel model={model} />
        </g>
      </>
    );
  }

  return (
    <FieldsDisc roles={ROLES} summary={summary} page={page} pageCount={pageCount}>
      <Header title={title} located={located} />
      {body}
    </FieldsDisc>
  );
}

const METRIC_GLYPH = { temp: Thermometer, conditions: CloudSun, precip: Droplet, wind: Wind, uv: Sun } as const;
const ACCENT = { drop: MARKS.drop, sun: MARKS.sun } as const;

/** The 12-hour chart on the platter. Bars start at zero; temperature uses
 *  dots, since degrees have no zero to stand a bar on. */
function Chart({ chart, hourCodes }: { chart: FieldsChart; hourCodes: { code: number; isDay: boolean }[] }) {
  const cw = 56;
  const x = (i: number) => 232 + cw * i;
  const base = 842;
  const label = (cx: number, y: number, text: string | null, weight = 800) =>
    text && (
      <text key={`${cx}-${y}`} x={cx} y={y} textAnchor="middle" dominantBaseline="central" fontSize="24"
            fontWeight={weight} className="font-fields-num" style={{ fill: INK }}>
        {text}
      </text>
    );
  let marks: ReactNode;
  if (chart.kind === 'marks') {
    marks = hourCodes.map((h, i) => <Mark key={i} code={h.code} isDay={h.isDay} cx={x(i)} cy={772} size={48} />);
  } else if (chart.kind === 'dots') {
    const min = Math.min(...chart.values);
    const span = Math.max(...chart.values) - min || 1;
    const y = (v: number) => base - 10 - ((v - min) / span) * 100;
    const pts = chart.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    marks = (
      <>
        <polyline points={pts} fill="none" strokeWidth={4} strokeLinejoin="round" opacity={0.5} style={{ stroke: INK }} />
        {chart.values.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r={10} style={{ fill: INK }} />
            {label(x(i), y(v) - 32, chart.valueLabels[i])}
          </g>
        ))}
      </>
    );
  } else {
    const max = chart.max ?? Math.max(...chart.values, 1);
    marks = chart.values.map((v, i) => {
      const h = Math.max(14, (v / max) * 120);
      const hot = chart.accent && chart.accentFrom !== undefined && v >= chart.accentFrom;
      return (
        <g key={i}>
          <rect x={x(i) - 11} y={base - h} width={22} height={h} rx={11}
                style={{ fill: hot && chart.accent ? ACCENT[chart.accent] : INK }} />
          {label(x(i), base - h - 22, chart.valueLabels[i])}
        </g>
      );
    });
  }
  return (
    <g>
      <rect x={180} y={644} width={720} height={270} rx={64} style={{ fill: PANEL }} />
      {marks}
      {chart.hourLabels.map((t, i) => label(x(i), 878, t, i === 0 ? 900 : 800))}
    </g>
  );
}

export interface FieldsWeatherMetricProps {
  page: MetricPage;
  model: WeatherModel;
  label: string;
  offline: boolean;
  updatedAt: Date | null;
  pageIndex: number;
  pageCount: number;
}

/** A dial page (temperature, conditions, rain, wind, UV) in the Fields skin:
 *  the same top half as Now, with a 12-hour chart on the platter. */
export function FieldsWeatherMetric({ page, model, label, offline, updatedAt, pageIndex, pageCount }: FieldsWeatherMetricProps) {
  const m = fieldsMetric(page, model);
  const Glyph = METRIC_GLYPH[page];
  const stale = offline && updatedAt !== null;
  const hours = hoursFromNow(model, 12);
  const summary =
    `${label ? `${label}, ` : ''}${m.title}: ${m.hero}, ${m.headline}. ${m.subline}.` +
    (stale && updatedAt ? ` Offline since ${hhmm(updatedAt)}.` : '');
  return (
    <FieldsDisc roles={ROLES} summary={summary} page={pageIndex} pageCount={pageCount}>
      <TitleRow
        roles={ROLES}
        title={m.title}
        leadWidth={56}
        lead={(x0) => (
          <g style={{ color: INK }}>
            <Glyph x={x0} y={122} width={40} height={40} strokeWidth={2.6} />
          </g>
        )}
      />
      <g opacity={stale ? STALE_OPACITY : 1}>
        <text x={C} y={367} textAnchor="middle" dominantBaseline="central" fontSize="280" fontWeight={900}
              letterSpacing="-8.4" className="font-fields-num" style={{ fill: INK }}>
          {m.hero}
        </text>
      </g>
      <Headline roles={ROLES} y={514}>{m.headline}</Headline>
      {stale && updatedAt
        ? <OutlineChip roles={ROLES} text={`Offline since ${hhmm(updatedAt)}`} cy={578} />
        : <Subline roles={ROLES} y={574}>{m.subline}</Subline>}
      <g opacity={stale ? STALE_OPACITY : 1}>
        <Chart chart={m.chart} hourCodes={hours} />
      </g>
    </FieldsDisc>
  );
}
