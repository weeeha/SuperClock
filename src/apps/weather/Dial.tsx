import { polar, ringSlots, type HourSample } from './weather-utils';

const C = 500;
const R_HOURS = 388;
const R_VALUES = 278;

export interface DialProps {
  hours: HourSample[];
  nowHour: number;
  /** Inner-ring label for one hour. */
  valueOf: (h: HourSample) => string;
  /** Inner-ring colour for one hour. Note: emoji-presentation glyphs ignore
   *  SVG `fill`, so this is a no-op for the conditions dial by design. */
  colorOf: (h: HourSample) => string;
  /** Font size for inner-ring labels — glyph pages want this larger. */
  valueSize?: number;
  centre: string;
  sub: string;
  caption: string;
}

/** One radial hour dial. The outer band carries the next 12 hours at their true
 *  clock positions; the inner band carries this metric's value for each hour.
 *  Every metric page is this component with a different formatter and ramp. */
export default function Dial({
  hours, nowHour, valueOf, colorOf, valueSize = 46, centre, sub, caption,
}: DialProps) {
  const slots = ringSlots(hours);

  return (
    <svg viewBox="0 0 1000 1000" className="h-full w-full">
      <circle cx={C} cy={C} r={R_HOURS} fill="none" stroke="#1a1a1c" strokeWidth={92} />
      <circle cx={C} cy={C} r={R_VALUES} fill="none" stroke="#111113" strokeWidth={92} />

      {slots.map((h, slot) => {
        if (!h) return null;
        const hp = polar(C, C, R_HOURS, slot);
        const vp = polar(C, C, R_VALUES, slot);
        const isNow = h.hour === nowHour;
        return (
          <g key={slot}>
            {isNow && <circle cx={hp.x} cy={hp.y} r={44} fill="#ffffff" />}
            <text
              x={hp.x} y={hp.y}
              textAnchor="middle" dominantBaseline="central"
              fontSize={44} fontWeight={isNow ? 600 : 500}
              fill={isNow ? '#000000' : '#7a7a80'}
            >
              {h.hour}
            </text>
            <text
              x={vp.x} y={vp.y}
              textAnchor="middle" dominantBaseline="central"
              fontSize={valueSize} fontWeight={500}
              fill={colorOf(h)}
              opacity={h.isDay ? 1 : 0.55}
            >
              {valueOf(h)}
            </text>
          </g>
        );
      })}

      <text x={C} y={C - 26} textAnchor="middle" dominantBaseline="central"
            fontSize={168} fontWeight={600} fill="#ffffff">
        {centre}
      </text>
      <text x={C} y={C + 78} textAnchor="middle" dominantBaseline="central"
            fontSize={38} fill="#b0b0b6">
        {sub}
      </text>
      <text x={C} y={C + 130} textAnchor="middle" dominantBaseline="central"
            fontSize={30} fill="#6a6a70">
        {caption}
      </text>
    </svg>
  );
}
