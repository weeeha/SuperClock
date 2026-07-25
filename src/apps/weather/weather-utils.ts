/** Open-Meteo returns zone-less local timestamps ("2026-07-24T20:00").
 *  `new Date(str)` parses those as UTC and then reads back local, shifting
 *  every hour label by the offset. Always come through here. */
export function parseLocalISO(iso: string): Date {
  const [datePart, timePart] = iso.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart ?? '00:00').split(':').map(Number);
  return new Date(y, mo - 1, d, hh || 0, mm || 0, 0, 0);
}

export function minutesSinceMidnight(iso: string): number {
  const d = parseLocalISO(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** Clock position for a 24h hour. Slot 0 is 12 o'clock, counting clockwise. */
export function clockSlot(hour: number): number {
  return ((hour % 12) + 12) % 12;
}

/** Scatter up to 12 consecutive hours onto the 12 clock positions.
 *  Twelve consecutive hours fill every slot exactly once. */
export function ringSlots<T extends { hour: number }>(hours: T[]): Array<T | null> {
  const slots: Array<T | null> = new Array(12).fill(null);
  for (const h of hours) slots[clockSlot(h.hour)] = h;
  return slots;
}

/** Cartesian point for a clock slot. Slot 0 is straight up; y grows downward
 *  to match the SVG coordinate system. */
export function polar(cx: number, cy: number, r: number, slot: number): { x: number; y: number } {
  const a = ((slot * 30 - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** How far through daylight we are, 0 at sunrise → 1 at sunset, clamped. */
export function dayProgress(nowMin: number, sunriseMin: number, sunsetMin: number): number {
  if (sunsetMin <= sunriseMin) return 0;
  const t = (nowMin - sunriseMin) / (sunsetMin - sunriseMin);
  return Math.min(1, Math.max(0, t));
}

export type ColorStop = [number, string];

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.slice(1);
  // Expand #abc shorthand to #aabbcc — parseInt on 3 digits would otherwise
  // be bit-shifted as if it were a 24-bit value and silently yield garbage.
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return rgbToHex(mix(pa[0], pb[0]), mix(pa[1], pb[1]), mix(pa[2], pb[2]));
}

/** Piecewise-linear colour ramp. Stops must be sorted ascending by value. */
export function rampColor(stops: ColorStop[], v: number): string {
  if (stops.length === 0) return '#888888';
  if (v <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (v >= last[0]) return last[1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i];
    const [v1, c1] = stops[i + 1];
    if (v >= v0 && v <= v1) {
      return lerpHex(c0, c1, v1 === v0 ? 0 : (v - v0) / (v1 - v0));
    }
  }
  return last[1];
}

export interface HourSample {
  /** Local hour of day, 0–23. */
  hour: number;
  temp: number;
  apparent: number;
  humidity: number;
  precipProb: number;
  windSpeed: number;
  windGust: number;
  uv: number;
  code: number;
  isDay: boolean;
}

export interface WeatherModel {
  current: {
    hour: number;
    temp: number;
    apparent: number;
    humidity: number;
    code: number;
    windSpeed: number;
    windDir: number;
    windGust: number;
    uv: number;
    precipProb: number;
    isDay: boolean;
  };
  today: { high: number; low: number; sunriseMin: number; sunsetMin: number };
  /** Up to 12 samples, starting at the current hour. */
  hours: HourSample[];
}

export interface OpenMeteoResponse {
  current: Record<string, number | string>;
  hourly: { time: string[] } & Record<string, number[] | string[]>;
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

function requireNumber(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Open-Meteo field "${field}" missing or not numeric (got ${JSON.stringify(value)})`);
  }
  return n;
}

export function parseForecast(json: OpenMeteoResponse, now: Date): WeatherModel {
  const times = json.hourly.time;
  const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
  const found = times.indexOf(key);
  let start = found;
  if (start < 0) {
    console.warn(`[weather] current hour ${key} not found in hourly.time; anchoring to index 0`);
    start = 0;
  }

  const num = (field: string, i: number) => requireNumber((json.hourly[field] as number[] | undefined)?.[i], field);

  const hours: HourSample[] = [];
  for (let i = start; i < Math.min(start + 12, times.length); i++) {
    hours.push({
      hour: parseLocalISO(times[i]).getHours(),
      temp: Math.round(num('temperature_2m', i)),
      apparent: Math.round(num('apparent_temperature', i)),
      humidity: Math.round(num('relative_humidity_2m', i)),
      precipProb: Math.round(num('precipitation_probability', i)),
      windSpeed: Math.round(num('wind_speed_10m', i)),
      windGust: Math.round(num('wind_gusts_10m', i)),
      uv: Math.round(num('uv_index', i)),
      code: num('weather_code', i),
      isDay: num('is_day', i) === 1,
    });
  }

  const c = json.current;
  const cnum = (field: string) => requireNumber(c[field], field);

  return {
    current: {
      hour: parseLocalISO(String(c.time)).getHours(),
      temp: Math.round(cnum('temperature_2m')),
      apparent: Math.round(cnum('apparent_temperature')),
      humidity: Math.round(cnum('relative_humidity_2m')),
      code: cnum('weather_code'),
      windSpeed: Math.round(cnum('wind_speed_10m')),
      windDir: Math.round(cnum('wind_direction_10m')),
      windGust: Math.round(cnum('wind_gusts_10m')),
      uv: Math.round(cnum('uv_index')),
      precipProb: Math.round(cnum('precipitation_probability')),
      isDay: cnum('is_day') === 1,
    },
    today: {
      high: Math.round(json.daily.temperature_2m_max[0]),
      low: Math.round(json.daily.temperature_2m_min[0]),
      sunriseMin: minutesSinceMidnight(json.daily.sunrise[0]),
      sunsetMin: minutesSinceMidnight(json.daily.sunset[0]),
    },
    hours,
  };
}
