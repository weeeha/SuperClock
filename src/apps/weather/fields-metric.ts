import type { WeatherPageId } from '../../shared/schemas/app.weather';
import type { ConditionMarkId } from './ConditionMark';
import { dialFor } from './dials';
import { rainPhrase, WET } from './rain-phrase';
import { codeMark, conditionLabel, type HourSample, type WeatherModel } from './weather-utils';

// The Fields skin's dial pages (temperature, conditions, rain, wind, UV): one
// hero value, a headline, a subline and a 12-hour series. Text comes from the
// Classic dials' own dialFor so the two skins never disagree about a number.

export type MetricPage = Exclude<WeatherPageId, 'now'>;

export interface FieldsChart {
  /** bars start at zero (rain, wind, UV); dots float (degrees have no zero);
   *  marks draw the condition for each hour. */
  kind: 'bars' | 'dots' | 'marks';
  values: number[];
  /** Top of the bar scale. Fixed per quantity so a quiet day draws short bars:
   *  a 9% chance of rain is not a full bar. */
  max?: number;
  marks?: ConditionMarkId[];
  /** Per column: a value label every third hour, else null. */
  valueLabels: (string | null)[];
  /** Per column: 'Now', then the hour every third column, else null. */
  hourLabels: (string | null)[];
  /** Bars at or above `accentFrom` take this colour role. */
  accent?: 'drop' | 'sun';
  accentFrom?: number;
}

export interface FieldsMetric {
  title: string;
  hero: string;
  headline: string;
  subline: string;
  chart: FieldsChart;
}

const HOURS = 12;
/** UV index scale top: the WHO bands end at 11+ ("extreme"). */
const UV_TOP = 11;
/** Wind bars fill only past this (km/h, the unit dialFor prints), so a calm day reads calm. */
const CALM_KMH = 40;
/** The next `n` hourly samples with the first one replaced by the current
 *  reading, so the column labelled Now always agrees with the hero above it
 *  (the hourly sample is the top of the hour; current is this minute). */
export function hoursFromNow(m: WeatherModel, n: number): HourSample[] {
  return m.hours.slice(0, n).map((h, i) => (i === 0 ? { ...h, ...m.current, hour: h.hour } : h));
}

const every3 = <T,>(xs: T[], f: (x: T) => string) => xs.map((x, i) => (i % 3 === 0 ? f(x) : null));

export function fieldsMetric(page: MetricPage, m: WeatherModel): FieldsMetric {
  const hours = hoursFromNow(m, HOURS);
  const dial = dialFor(page, m);
  const hourLabels = hours.map((h, i) => (i === 0 ? 'Now' : i % 3 === 0 ? String(h.hour).padStart(2, '0') : null));
  const hl = `H:${m.today.high}°   L:${m.today.low}°`;

  switch (page) {
    case 'temp': {
      const values = hours.map((h) => h.temp);
      return {
        title: 'Temperature', hero: `${m.current.temp}°`, headline: dial?.sub ?? '', subline: hl,
        chart: { kind: 'dots', values, valueLabels: every3(values, (v) => `${v}°`), hourLabels },
      };
    }
    case 'conditions':
      return {
        title: 'Conditions', hero: `${m.current.temp}°`, headline: conditionLabel(m.current.code), subline: hl,
        chart: {
          kind: 'marks', values: hours.map((h) => h.temp), marks: hours.map((h) => codeMark(h.code, h.isDay)),
          valueLabels: hours.map(() => null), hourLabels,
        },
      };
    case 'precip': {
      const values = hours.map((h) => h.precipProb);
      const { change } = rainPhrase(m);
      const wetNow = m.current.precipProb >= WET;
      return {
        title: 'Rain', hero: `${m.current.precipProb}%`,
        headline: change ?? (wetNow ? 'Rain for the next hours' : 'No rain expected'),
        subline: dial?.caption ?? '',
        chart: { kind: 'bars', values, max: 100, valueLabels: every3(values, (v) => `${v}%`), hourLabels, accent: 'drop', accentFrom: WET },
      };
    }
    case 'wind': {
      const values = hours.map((h) => h.windSpeed);
      return {
        title: 'Wind', hero: String(m.current.windSpeed), headline: dial?.sub ?? '', subline: dial?.caption ?? '',
        chart: { kind: 'bars', values, max: Math.max(CALM_KMH, ...values), valueLabels: every3(values, String), hourLabels },
      };
    }
    case 'uv': {
      const values = hours.map((h) => h.uv);
      return {
        title: 'UV index', hero: String(m.current.uv), headline: dial?.sub ?? '', subline: dial?.caption ?? '',
        chart: { kind: 'bars', values, max: Math.max(UV_TOP, ...values), valueLabels: every3(values, String), hourLabels, accent: 'sun', accentFrom: 3 },
      };
    }
  }
}
