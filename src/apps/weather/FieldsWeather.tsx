import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Cloud, MapPin, WifiOff } from 'lucide-react';
import type { WeatherModel } from './weather-utils';
import { rainPhrase } from './rain-phrase';

// Weather's Now screen in the Fields skin (src/shared/skins.ts). Geometry is
// the 1080 design frame from Figma (SupeClock-Design, "4B · Widget fields",
// Weather 38:5 and the states section 54:2), drawn 1:1 in a 1080 viewBox.
// Colour comes only from the four --fields-weather* roles in tokens.css, which
// flip for night there: this component has no night branch of its own.

const C = 540;
const FIELD = 'var(--fields-weather)';
const INK = 'var(--fields-weather-ink)';
const PANEL = 'var(--fields-weather-panel)';
const TRACK = 'var(--fields-weather-track)';
/** Now plus the next five hours, in six 103 px columns from x 230. */
const HOURS_SHOWN = 6;
const COL_X0 = 230;
const COL_W = 103.33;
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

/** Icon tile + title, centred together on the disc (tile 76, gap 20). */
function Header({ title }: { title: string }) {
  const [ref, width] = useTextWidth(title);
  const x0 = C - (96 + width) / 2;
  return (
    <g opacity={width > 0 ? 1 : 0}>
      <rect x={x0} y={130} width={76} height={76} rx={22} style={{ fill: INK }} />
      <Cloud x={x0 + 16} y={146} width={44} height={44} strokeWidth={2.4} style={{ color: FIELD }} />
      <text ref={ref} x={x0 + 96} y={168} dominantBaseline="central" fontSize="44"
            className="font-fields-serif" style={{ fill: INK }}>
        {title}
      </text>
    </g>
  );
}

/** Fraunces sentence with one word set in SemiBold Italic. */
function Sentence({ text, emphasis }: { text: string; emphasis: string | null }) {
  const i = emphasis ? text.indexOf(emphasis) : -1;
  return (
    <text x={C} y={599} textAnchor="middle" dominantBaseline="central" fontSize="44"
          className="font-fields-serif" style={{ fill: INK }}>
      {i < 0 || !emphasis ? text : (
        <>
          {text.slice(0, i)}
          <tspan fontStyle="italic" fontWeight={600}>{emphasis}</tspan>
          {text.slice(i + emphasis.length)}
        </>
      )}
    </text>
  );
}

/** The detail slot (y 634): a plain line, or a chip in the same place. */
function Detail({ children }: { children: string }) {
  return (
    <text x={C} y={660} textAnchor="middle" dominantBaseline="central" fontSize="38" fontWeight={700}
          className="font-fields-num" style={{ fill: INK, whiteSpace: 'pre' }}>
      {children}
    </text>
  );
}

/** Outline chip: the stale tell. Never a new hue (spec, decision 7). */
function OutlineChip({ text }: { text: string }) {
  const [ref, width] = useTextWidth(text);
  const w = width + 56;
  return (
    <g opacity={width > 0 ? 1 : 0}>
      <rect x={C - w / 2} y={628} width={w} height={62} rx={31} fill="none" strokeWidth={3}
            style={{ stroke: INK }} />
      <text ref={ref} x={C} y={659} textAnchor="middle" dominantBaseline="central" fontSize="30"
            fontWeight={700} className="font-fields-num" style={{ fill: INK }}>
        {text}
      </text>
    </g>
  );
}

/** Rain chance for now and the next five hours. Bars are ink on the track,
 *  the percentage above and the hour below. */
function HourlyPanel({ model }: { model: WeatherModel }) {
  const hours = model.hours.slice(0, HOURS_SHOWN);
  return (
    <g>
      <rect x={210} y={704} width={660} height={210} rx={52} style={{ fill: PANEL }} />
      {hours.map((h, i) => {
        const cx = COL_X0 + COL_W * (i + 0.5);
        const bar = Math.max(30, (88 * h.precipProb) / 100);
        return (
          <g key={h.hour}>
            <text x={cx} y={739} textAnchor="middle" dominantBaseline="central" fontSize="28"
                  fontWeight={800} className="font-fields-num" style={{ fill: INK }}>
              {h.precipProb}%
            </text>
            <rect x={cx - 15} y={766} width={30} height={88} rx={15} style={{ fill: TRACK }} />
            <rect x={cx - 15} y={854 - bar} width={30} height={bar} rx={15} style={{ fill: INK }} />
            <text x={cx} y={881} textAnchor="middle" dominantBaseline="central" fontSize="28"
                  fontWeight={i === 0 ? 900 : 700} className="font-fields-num" style={{ fill: INK }}>
              {i === 0 ? 'Now' : String(h.hour).padStart(2, '0')}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** A lucide glyph in the value slot, for screens with nothing to show. */
function Glyph({ children }: { children: ReactNode }) {
  return <g style={{ color: INK }}>{children}</g>;
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
  const title = label || 'Weather';
  let body: ReactNode;
  let summary: string;

  if (unconfigured) {
    summary = 'Weather is not set up. Pick a place in the admin.';
    body = (
      <>
        <Glyph><MapPin x={445} y={297} width={190} height={190} strokeWidth={1.6} /></Glyph>
        <Sentence text="Pick a place in the admin" emphasis="Pick a place" />
        <Detail>Then the forecast appears here</Detail>
      </>
    );
  } else if (!model && offline) {
    summary = 'No weather yet. The forecast cannot be reached.';
    body = (
      <>
        <Glyph><WifiOff x={445} y={297} width={190} height={190} strokeWidth={1.6} /></Glyph>
        <Sentence text="No weather yet" emphasis="No weather" />
        <Detail>Can’t reach the forecast. Trying again.</Detail>
      </>
    );
  } else if (!model) {
    // Loading: the header alone. Nothing is drawn that the fetch has not said.
    summary = 'Loading the forecast.';
    body = null;
  } else {
    const phrase = rainPhrase(model);
    const stale = offline;
    summary = `${title}: ${model.current.temp} degrees. ${phrase.sentence}.${stale && updatedAt ? ` Offline since ${hhmm(updatedAt)}.` : ''}`;
    body = (
      <>
        <g opacity={stale ? STALE_OPACITY : 1}>
          <text x={C + 8} y={405} textAnchor="middle" dominantBaseline="central" fontSize="280"
                fontWeight={800} letterSpacing="-5.6" className="font-fields-num" style={{ fill: INK }}>
            {model.current.temp}°
          </text>
        </g>
        <Sentence text={phrase.sentence} emphasis={phrase.emphasis} />
        {stale && updatedAt
          ? <OutlineChip text={`Offline since ${hhmm(updatedAt)}`} />
          : <Detail>{`H ${model.today.high}°   L ${model.today.low}°`}</Detail>}
        <g opacity={stale ? STALE_OPACITY : 1}>
          <HourlyPanel model={model} />
        </g>
      </>
    );
  }

  return (
    <svg viewBox="0 0 1080 1080" className="h-full w-full" role="img" aria-label={summary}>
      <circle cx={C} cy={C} r={C} style={{ fill: FIELD }} />
      <Header title={unconfigured ? 'Weather' : title} />
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
