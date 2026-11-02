import { compass, conditionLabel, dayProgress, type WeatherModel } from './weather-utils';

const C = 500;
const R_ARC = 455;

/** Sunrise → sunset arc hugging the bezel: the top semicircle, swept left to
 *  right. Uses rim space the centre column can't reach. */
function dayArcPath(): string {
  return `M ${C - R_ARC} ${C} A ${R_ARC} ${R_ARC} 0 0 1 ${C + R_ARC} ${C}`;
}

function sunPoint(progress: number): { x: number; y: number } {
  const a = Math.PI - progress * Math.PI;
  return { x: C + R_ARC * Math.cos(a), y: C - R_ARC * Math.sin(a) };
}

export interface NowPageProps {
  model: WeatherModel;
  label: string;
  now: Date;
}

export default function NowPage({ model, label, now }: NowPageProps) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const progress = dayProgress(nowMin, model.today.sunriseMin, model.today.sunsetMin);
  const sun = sunPoint(progress);
  const daylight = nowMin >= model.today.sunriseMin && nowMin <= model.today.sunsetMin;

  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  return (
    <svg viewBox="0 0 1000 1000" className="h-full w-full">
      {/* The sky is the page: the app wrapper paints --face-bg. The one accent
          is the sun marker; the arc is its track. */}
      <path d={dayArcPath()} fill="none" stroke="var(--face-ghost)" strokeWidth={5} />
      <circle cx={sun.x} cy={sun.y} r={26} fill={daylight ? '#5b93c9' : 'var(--face-ink)'} />

      <text x={C} y={196} textAnchor="middle" dominantBaseline="central"
            fontSize={34} fill="var(--face-ink-muted)">
        {label ? `⌖ ${label}, ${hhmm}` : hhmm}
      </text>

      <text x={C} y={412} textAnchor="middle" dominantBaseline="central"
            fontSize={230} fontWeight={600} fill="var(--face-ink)">
        {model.current.temp}°
      </text>

      <text x={C} y={560} textAnchor="middle" dominantBaseline="central"
            fontSize={44} fill="var(--face-ink)">
        {conditionLabel(model.current.code)}
      </text>
      <text x={C} y={614} textAnchor="middle" dominantBaseline="central"
            fontSize={34} fill="var(--face-ink-muted)">
        {`H ${model.today.high}°     L ${model.today.low}°`}
      </text>

      <text x={112} y={520} textAnchor="middle" fontSize={26} fill="var(--face-tick)">
        {fmt(model.today.sunriseMin)}
      </text>
      <text x={888} y={520} textAnchor="middle" fontSize={26} fill="var(--face-tick)">
        {fmt(model.today.sunsetMin)}
      </text>

      {[
        ['UV', String(model.current.uv)],
        ['WIND', `${model.current.windSpeed} km/h ${compass(model.current.windDir)}`],
        ['HUMIDITY', `${model.current.humidity}%`],
      ].map(([k, v], i) => {
        const x = 268 + i * 232;
        return (
          <g key={k}>
            <text x={x} y={766} textAnchor="middle" fontSize={24}
                  fill="var(--face-tick)">{k}</text>
            <text x={x} y={812} textAnchor="middle" fontSize={34} fill="var(--face-ink)">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}
