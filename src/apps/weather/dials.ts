import type { DialProps } from './Dial';
import type { WeatherPageId } from '../../shared/schemas/app.weather';
import {
  RAMPS, codeGlyph, compass, conditionLabel, rampColor,
  type HourSample, type WeatherModel,
} from './weather-utils';

/** WHO/EPA UV Index bands — matches the colour stops in RAMPS.uv. */
export function uvLabel(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Maps a page id to the props its dial needs. Pure and testable — the whole
 *  reason it lives here rather than inside the component. Returns null for
 *  'now', which is the ambient page rather than a dial. */
export function dialFor(page: WeatherPageId, m: WeatherModel): DialProps | null {
  const base = { hours: m.hours, nowHour: m.current.hour };

  switch (page) {
    case 'temp':
      return {
        ...base,
        valueOf: (h: HourSample) => `${h.temp}°`,
        colorOf: (h: HourSample) => rampColor(RAMPS.temp, h.temp),
        centre: `${m.current.temp}°`,
        sub: `Feels like ${m.current.apparent}°`,
        caption: `H ${m.today.high}°     L ${m.today.low}°`,
      };

    case 'conditions':
      return {
        ...base,
        valueOf: (h: HourSample) => codeGlyph(h.code, h.isDay),
        colorOf: () => '#e8e8ec',
        valueSize: 58,
        centre: `${m.current.temp}°`,
        sub: conditionLabel(m.current.code),
        caption: `H ${m.today.high}°     L ${m.today.low}°`,
      };

    case 'precip': {
      const peak = m.hours.reduce(
        (a, b) => (b.precipProb > a.precipProb ? b : a),
        m.hours[0],
      );
      return {
        ...base,
        valueOf: (h: HourSample) => `${h.precipProb}%`,
        colorOf: (h: HourSample) => rampColor(RAMPS.precip, h.precipProb),
        valueSize: 38,
        centre: `${m.current.precipProb}%`,
        sub: 'Chance now',
        caption: peak.precipProb > 0
          ? `Peaks at ${peak.precipProb}% around ${hh(peak.hour)}`
          : 'None expected in 12h',
      };
    }

    case 'wind':
      return {
        ...base,
        valueOf: (h: HourSample) => String(h.windSpeed),
        colorOf: (h: HourSample) => rampColor(RAMPS.wind, h.windSpeed),
        valueSize: 42,
        centre: String(m.current.windSpeed),
        sub: `km/h  ${compass(m.current.windDir)}`,
        caption: `Gusts to ${m.current.windGust} km/h`,
      };

    case 'uv':
      return {
        ...base,
        valueOf: (h: HourSample) => String(h.uv),
        colorOf: (h: HourSample) => rampColor(RAMPS.uv, h.uv),
        valueSize: 42,
        centre: String(m.current.uv),
        sub: uvLabel(m.current.uv),
        caption: `Peak today ${Math.max(...m.hours.map((h) => h.uv))}`,
      };

    default:
      return null;
  }
}
