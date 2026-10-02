import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { MapPin, WifiOff } from 'lucide-react';
import ConditionMark, { type MarkPalette } from './ConditionMark';
import { codeMark, type WeatherModel } from './weather-utils';
import { rainPhrase } from './rain-phrase';

// Weather's Now screen in the Fields skin (src/shared/skins.ts), v2: the
// watchOS look Nick asked for on 2026-10-02 ("icons, bolder font, Apple Watch
// apps as the quality reference"). Geometry is the 1080 design frame from
// Figma (SupeClock-Design, "4B v2 · Watch quality", Weather V1 63:5), drawn
// 1:1 in a 1080 viewBox. Colour comes only from the --fields-weather* roles in
// tokens.css, which flip for night there: no night branch here.

const C = 540;
const FIELD = 'var(--fields-weather)';
const INK = 'var(--fields-weather-ink)';
const SOFT = 'var(--fields-weather-ink-soft)';
const PANEL = 'var(--fields-weather-panel)';
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

/** Width of an SVG text node once the bundled fonts have loaded. The first
 *  paint may use a fallback face, so the measure waits for document.fonts. */
function useTextWidth(text: string): [RefObject<SVGTextElement | null>, number] {
  const ref = useRef<SVGTextElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let live = true;
    const measure = () => {
      const el = ref.current;
      if (live && el && typeof el.getComputedTextLength === 'function') setWidth(el.getComputedTextLength());
    };
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (fonts?.ready) fonts.ready.then(measure);
    else queueMicrotask(measure);
    return () => {
      live = false;
    };
  }, [text]);
  return [ref, width];
}

/** A condition mark scaled from its 48-unit box, centred at (cx, cy). */
function Mark({ code, isDay, cx, cy, size }: { code: number; isDay: boolean; cx: number; cy: number; size: number }) {
  const id = codeMark(code, isDay);
  return (
    <g data-mark={id} transform={`translate(${cx} ${cy}) scale(${size / 48})`}>
      <ConditionMark id={id} palette={MARKS} />
    </g>
  );
}

/** Location row: a filled arrow and the place, centred together. With no
 *  place name (coordinates, or not set up) the arrow is left out. */
function Header({ title, located }: { title: string; located: boolean }) {
  const [ref, width] = useTextWidth(title);
  const arrow = located ? 42 : 0;
  const x0 = C - (arrow + width) / 2;
  return (
    <g opacity={width > 0 ? 1 : 0}>
      {located && (
        <path d={`M ${x0} ${136} L ${x0 + 30} ${124} L ${x0 + 18} ${154} L ${x0 + 15} ${139} Z`}
              style={{ fill: INK }} />
      )}
      <text ref={ref} x={x0 + arrow} y={142} dominantBaseline="central" fontSize="44" fontWeight={800}
            className="font-fields-num" style={{ fill: INK }}>
        {title}
      </text>
    </g>
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

/** A lucide glyph in the hero slot, for screens with nothing to show. */
function HeroGlyph({ children }: { children: ReactNode }) {
  return <g style={{ color: INK }}>{children}</g>;
}

const Headline = ({ children }: { children: string }) => (
  <text x={C} y={524} textAnchor="middle" dominantBaseline="central" fontSize="56" fontWeight={900}
        className="font-fields-num" style={{ fill: INK }}>
    {children}
  </text>
);

const Subline = ({ children }: { children: string }) => (
  <text x={C} y={579} textAnchor="middle" dominantBaseline="central" fontSize="40" fontWeight={800}
        className="font-fields-num" style={{ fill: SOFT, whiteSpace: 'pre' }}>
    {children}
  </text>
);

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

/** Outline chip in the change slot: the stale tell. Never a new hue. */
function OutlineChip({ text }: { text: string }) {
  const [ref, width] = useTextWidth(text);
  const w = width + 56;
  return (
    <g opacity={width > 0 ? 1 : 0}>
      <rect x={C - w / 2} y={598} width={w} height={58} rx={29} fill="none" strokeWidth={3}
            style={{ stroke: INK }} />
      <text ref={ref} x={C} y={627} textAnchor="middle" dominantBaseline="central" fontSize="30"
            fontWeight={800} className="font-fields-num" style={{ fill: INK }}>
        {text}
      </text>
    </g>
  );
}

/** Now and the next five hours: hour, mark, temperature, and the rain chance
 *  when it matters. Everything on the panel uses the full ink (the soft ink
 *  reads 3.6:1 there). */
function HourlyPanel({ model }: { model: WeatherModel }) {
  const hours = model.hours.slice(0, HOURS_SHOWN);
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
        <HeroGlyph><MapPin x={445} y={235} width={190} height={190} strokeWidth={2} /></HeroGlyph>
        <Headline>Pick a place</Headline>
        <Subline>Set a location in the admin</Subline>
      </>
    );
  } else if (!model && offline) {
    summary = 'No weather yet. The forecast cannot be reached.';
    body = (
      <>
        <HeroGlyph><WifiOff x={445} y={235} width={190} height={190} strokeWidth={2} /></HeroGlyph>
        <Headline>No weather yet</Headline>
        <Subline>Can’t reach the forecast</Subline>
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
        <Headline>{condition}</Headline>
        <Subline>{`H:${model.today.high}°   L:${model.today.low}°`}</Subline>
        {stale && updatedAt
          ? <OutlineChip text={`Offline since ${hhmm(updatedAt)}`} />
          : change && <ChangeLine text={change} />}
        <g opacity={stale ? STALE_OPACITY : 1}>
          <HourlyPanel model={model} />
        </g>
      </>
    );
  }

  return (
    <svg viewBox="0 0 1080 1080" className="h-full w-full" role="img" aria-label={summary}>
      <circle cx={C} cy={C} r={C} style={{ fill: FIELD }} />
      <Header title={title} located={located} />
      {body}
      {pageCount > 1 && (
        <g>
          {Array.from({ length: pageCount }, (_, i) => (
            <circle key={i} cx={C + (i - (pageCount - 1) / 2) * 22} cy={968} r={6}
                    opacity={i === page ? 1 : 0.35} style={{ fill: INK }} />
          ))}
        </g>
      )}
    </svg>
  );
}
