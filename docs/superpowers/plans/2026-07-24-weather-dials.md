# Weather Dials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single static weather screen with a six-page swipe stack — an ambient "Now" page plus five hourly radial dials (temp, conditions, precip, wind, UV) — driven by fleet config instead of build-time env vars.

**Architecture:** All geometry, colour and API-parsing logic lives in a pure, unit-tested `weather-utils.ts`; React components stay thin. One `<Dial>` component is parameterised by a value formatter and a colour ramp, so five metric pages are five prop sets rather than five components. A single Open-Meteo request every 15 minutes feeds every page. Page state, vertical-swipe handling and the idle auto-return live in `WeatherApp.tsx`, following the `HabitsApp` pattern exactly.

**Tech Stack:** React 19 + TypeScript (`verbatimModuleSyntax`, `erasableSyntaxOnly`), Zustand navigation store, Tailwind v4, inline SVG (no chart library), Vitest (node environment — no jsdom, no component tests), Open-Meteo (keyless).

---

## Design Reference

Wireframes: [Figma — Weather app v1](https://www.figma.com/board/JAjMCsw8hXx38locrxP5gd/SuperClock-fresh-thinking?node-id=35-680) (Designs page, section `35:680`).

**Dial grammar** (identical on all five metric pages):
- **Outer band** — the next 12 hours, each drawn at its true clock position (hour 17 sits on the 5 o'clock mark). Current hour is a filled pill; it is the only high-contrast element on the ring.
- **Inner band** — that metric's value for each hour, tinted by a value→colour ramp.
- **Centre** — current value, a one-word qualifier, and a one-line caption.
- **Bottom rim** — page dots.

**Now page** — sky-tinted background, location + time on the top rim, temperature in the centre, condition and H/L below, a day-arc riding the bezel from sunrise to sunset with a marker at the current time, and three small readouts (UV / wind / humidity).

## Verified API Facts

Confirmed live against Open-Meteo on 2026-07-24. **Do not re-derive these; they are correct.**

- One request returns everything: `current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,precipitation_probability,is_day`, `hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m,uv_index,weather_code,is_day`, `daily=temperature_2m_max,temperature_2m_min,sunrise,sunset`.
- Keyless — **no server proxy is needed**, unlike the GitHub/Claude-usage pattern. Fetch directly from the kiosk.
- `hourly.is_day` is `0|1` per hour, so night styling never needs deriving from sunrise/sunset.
- **Times come back as local ISO strings with no zone suffix** (`"2026-07-24T20:00"`, `sunrise: "2026-07-24T05:29"`). `new Date(str)` parses these as **UTC** and then reads back local, shifting everything by the offset. This bug is already documented in the current `WeatherApp.tsx:74-76`. Always parse with `parseLocalISO`.
- `hourly.time` starts at 00:00 **of the first forecast day**, not at the current hour — find the current hour's index by string match.
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name=<q>&count=1&language=en&format=json` → `{ results: [{ name, latitude, longitude, timezone, country }] }`. Also keyless.

## File Structure

| File | Responsibility |
|---|---|
| `src/apps/weather/weather-utils.ts` | **Create.** Pure functions: local-ISO parsing, ring slot math, polar coords, day progress, colour ramps, glyphs, Open-Meteo → `WeatherModel`. No React, no fetch, no URLs. |
| `src/apps/weather/weather-utils.test.ts` | **Create.** Vitest coverage for every exported util. |
| `src/apps/weather/weather-api.ts` | **Create.** Network *shape* only: coordinate parsing and URL builders. Split out of `weather-utils.ts` after a Task 3 review flagged that file drifting toward an "everything module" — network concerns and pure math are separate responsibilities. |
| `src/apps/weather/weather-api.test.ts` | **Create.** Vitest coverage for coord parsing and URL construction. |
| `src/apps/weather/useWeather.ts` | **Create.** Fetch + refresh + offline state + location resolution. |
| `src/apps/weather/Dial.tsx` | **Create.** The one radial component all five metric pages use. |
| `src/apps/weather/NowPage.tsx` | **Create.** Ambient resting page. |
| `src/apps/weather/WeatherApp.tsx` | **Rewrite.** Page state, vertical swipe, idle return, dots. |
| `src/shared/schemas/app.weather.ts` | **Modify.** Replace `forecastDays` with `pages` + `idleReturnSeconds`. |

**Conventions that are not optional here** (from `CLAUDE.md`):
- Gate every `setInterval`/`setTimeout` on `props.isActive` — background apps must not tick.
- Honest offline: never render fallback numbers as if live.
- No secrets in `VITE_`-prefixed vars (not an issue here — the API is keyless).
- `import type` for type-only imports; no enums.

---

### Task 1: Pure geometry and colour utilities

**Files:**
- Create: `src/apps/weather/weather-utils.ts`
- Test: `src/apps/weather/weather-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/apps/weather/weather-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  parseLocalISO,
  minutesSinceMidnight,
  clockSlot,
  ringSlots,
  polar,
  dayProgress,
  rampColor,
} from './weather-utils';

describe('parseLocalISO', () => {
  it('reads a zone-less Open-Meteo timestamp as LOCAL, not UTC', () => {
    const d = parseLocalISO('2026-07-24T20:00');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July
    expect(d.getDate()).toBe(24);
    expect(d.getHours()).toBe(20);
    expect(d.getMinutes()).toBe(0);
  });

  it('handles a date-only string', () => {
    const d = parseLocalISO('2026-07-24');
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(24);
  });
});

describe('minutesSinceMidnight', () => {
  it('converts a local timestamp to minutes', () => {
    expect(minutesSinceMidnight('2026-07-24T05:29')).toBe(5 * 60 + 29);
    expect(minutesSinceMidnight('2026-07-24T20:32')).toBe(20 * 60 + 32);
  });
});

describe('clockSlot', () => {
  it('maps 24h hours onto 12 clock positions', () => {
    expect(clockSlot(0)).toBe(0);   // midnight at the top
    expect(clockSlot(12)).toBe(0);  // noon also at the top
    expect(clockSlot(17)).toBe(5);  // 17:00 sits on the 5 mark
    expect(clockSlot(23)).toBe(11);
  });
});

describe('ringSlots', () => {
  it('places 12 consecutive hours into 12 distinct slots', () => {
    const hours = [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4].map((hour) => ({ hour }));
    const slots = ringSlots(hours);
    expect(slots).toHaveLength(12);
    expect(slots.every((s) => s !== null)).toBe(true);
    expect(slots[5]!.hour).toBe(17);
    expect(slots[0]!.hour).toBe(0);
    expect(slots[11]!.hour).toBe(23);
  });

  it('leaves gaps as null when fewer than 12 hours are supplied', () => {
    const slots = ringSlots([{ hour: 17 }, { hour: 18 }]);
    expect(slots[5]!.hour).toBe(17);
    expect(slots[6]!.hour).toBe(18);
    expect(slots[0]).toBeNull();
  });
});

describe('polar', () => {
  it('puts slot 0 at the top and slot 3 at the right', () => {
    const top = polar(500, 500, 100, 0);
    expect(Math.round(top.x)).toBe(500);
    expect(Math.round(top.y)).toBe(400);

    const right = polar(500, 500, 100, 3);
    expect(Math.round(right.x)).toBe(600);
    expect(Math.round(right.y)).toBe(500);
  });
});

describe('dayProgress', () => {
  const sunrise = 5 * 60 + 29;
  const sunset = 20 * 60 + 32;

  it('is 0 at sunrise and 1 at sunset', () => {
    expect(dayProgress(sunrise, sunrise, sunset)).toBe(0);
    expect(dayProgress(sunset, sunrise, sunset)).toBe(1);
  });

  it('clamps outside daylight', () => {
    expect(dayProgress(60, sunrise, sunset)).toBe(0);
    expect(dayProgress(23 * 60, sunrise, sunset)).toBe(1);
  });

  it('is about 0.79 at 17:25', () => {
    expect(dayProgress(17 * 60 + 25, sunrise, sunset)).toBeCloseTo(0.794, 2);
  });
});

describe('rampColor', () => {
  const stops: Array<[number, string]> = [
    [0, '#000000'],
    [10, '#ffffff'],
  ];

  it('returns endpoint colours outside the range', () => {
    expect(rampColor(stops, -5)).toBe('#000000');
    expect(rampColor(stops, 99)).toBe('#ffffff');
  });

  it('interpolates in between', () => {
    expect(rampColor(stops, 5)).toBe('#808080');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- weather-utils`
Expected: FAIL — `Failed to resolve import "./weather-utils"`.

- [ ] **Step 3: Write the implementation**

Create `src/apps/weather/weather-utils.ts`:

```ts
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
  const n = parseInt(hex.slice(1), 16);
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- weather-utils`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/apps/weather/weather-utils.ts src/apps/weather/weather-utils.test.ts
git commit -m "feat(weather): add pure dial geometry and colour ramp utilities"
```

---

### Task 2: Parse the Open-Meteo response into a WeatherModel

**Files:**
- Modify: `src/apps/weather/weather-utils.ts`
- Test: `src/apps/weather/weather-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/apps/weather/weather-utils.test.ts`:

```ts
import { parseForecast } from './weather-utils';

/** Trimmed but structurally exact Open-Meteo payload. 18 hourly entries so the
 *  12-hour window starting at 17:00 runs off the end of day one. */
function fixture() {
  const time: string[] = [];
  for (let hh = 0; hh < 24; hh++) time.push(`2026-07-24T${String(hh).padStart(2, '0')}:00`);
  for (let hh = 0; hh < 12; hh++) time.push(`2026-07-25T${String(hh).padStart(2, '0')}:00`);
  const n = time.length;
  const seq = (f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));
  return {
    utc_offset_seconds: -14400,
    current: {
      time: '2026-07-24T17:00',
      temperature_2m: 27.4,
      apparent_temperature: 28.1,
      relative_humidity_2m: 51,
      weather_code: 1,
      wind_speed_10m: 11.2,
      wind_direction_10m: 234,
      wind_gusts_10m: 21.3,
      uv_index: 2.4,
      precipitation_probability: 0,
      is_day: 1,
    },
    hourly: {
      time,
      temperature_2m: seq((i) => 20 + (i % 12)),
      apparent_temperature: seq((i) => 21 + (i % 12)),
      relative_humidity_2m: seq(() => 50),
      precipitation_probability: seq((i) => i % 30),
      wind_speed_10m: seq(() => 11),
      wind_gusts_10m: seq(() => 21),
      uv_index: seq((i) => (i % 12) / 4),
      weather_code: seq(() => 1),
      is_day: seq((i) => (i % 24 >= 6 && i % 24 < 20 ? 1 : 0)),
    },
    daily: {
      time: ['2026-07-24', '2026-07-25'],
      temperature_2m_max: [27, 29],
      temperature_2m_min: [15, 17],
      sunrise: ['2026-07-24T05:29', '2026-07-25T05:30'],
      sunset: ['2026-07-24T20:32', '2026-07-25T20:31'],
    },
  };
}

describe('parseForecast', () => {
  const now = new Date(2026, 6, 24, 17, 25, 0);

  it('returns exactly 12 hours starting at the current hour', () => {
    const m = parseForecast(fixture(), now);
    expect(m.hours).toHaveLength(12);
    expect(m.hours[0].hour).toBe(17);
    expect(m.hours.map((h) => h.hour)).toEqual([17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4]);
  });

  it('rounds current readings and keeps wind direction', () => {
    const m = parseForecast(fixture(), now);
    expect(m.current.temp).toBe(27);
    expect(m.current.apparent).toBe(28);
    expect(m.current.humidity).toBe(51);
    expect(m.current.windSpeed).toBe(11);
    expect(m.current.windGust).toBe(21);
    expect(m.current.windDir).toBe(234);
    expect(m.current.uv).toBe(2);
    expect(m.current.isDay).toBe(true);
  });

  it('reads today high/low and sunrise/sunset as local minutes', () => {
    const m = parseForecast(fixture(), now);
    expect(m.today.high).toBe(27);
    expect(m.today.low).toBe(15);
    expect(m.today.sunriseMin).toBe(5 * 60 + 29);
    expect(m.today.sunsetMin).toBe(20 * 60 + 32);
  });

  it('crosses midnight into the next forecast day', () => {
    const m = parseForecast(fixture(), now);
    const past = m.hours.slice(7);
    expect(past.map((h) => h.hour)).toEqual([0, 1, 2, 3, 4]);
    expect(past.every((h) => !h.isDay)).toBe(true);
  });

  it('falls back to the first hour when the current hour is missing', () => {
    const f = fixture();
    const m = parseForecast(f, new Date(2026, 0, 1, 3, 0, 0));
    expect(m.hours).toHaveLength(12);
    expect(m.hours[0].hour).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- weather-utils`
Expected: FAIL — `parseForecast is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/apps/weather/weather-utils.ts`:

```ts
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
  daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; sunrise: string[]; sunset: string[] };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function parseForecast(json: OpenMeteoResponse, now: Date): WeatherModel {
  const times = json.hourly.time;
  const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
  const found = times.indexOf(key);
  const start = found >= 0 ? found : 0;

  const num = (field: string, i: number) => Number((json.hourly[field] as number[])[i]);

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
  const cnum = (field: string) => Number(c[field]);

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- weather-utils`
Expected: PASS — 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/apps/weather/weather-utils.ts src/apps/weather/weather-utils.test.ts
git commit -m "feat(weather): parse Open-Meteo payload into a typed WeatherModel"
```

---

### Task 3: Add condition glyphs and metric page descriptors

**Files:**
- Modify: `src/apps/weather/weather-utils.ts`
- Test: `src/apps/weather/weather-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/apps/weather/weather-utils.test.ts`:

```ts
import { codeGlyph, conditionLabel, compass } from './weather-utils';

describe('codeGlyph', () => {
  it('uses day and night variants for clear skies', () => {
    expect(codeGlyph(0, true)).toBe('☀');
    expect(codeGlyph(0, false)).toBe('☾');
  });

  it('maps WMO ranges to glyph families', () => {
    expect(codeGlyph(3, true)).toBe('☁');
    expect(codeGlyph(61, true)).toBe('🌧');
    expect(codeGlyph(71, true)).toBe('❄');
    expect(codeGlyph(95, true)).toBe('⛈');
  });
});

describe('conditionLabel', () => {
  it('names the common codes', () => {
    expect(conditionLabel(0)).toBe('Clear');
    expect(conditionLabel(2)).toBe('Partly Cloudy');
    expect(conditionLabel(95)).toBe('Thunderstorm');
  });
});

describe('compass', () => {
  it('converts bearings to 8-point names', () => {
    expect(compass(0)).toBe('N');
    expect(compass(90)).toBe('E');
    expect(compass(234)).toBe('SW');
    expect(compass(359)).toBe('N');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- weather-utils`
Expected: FAIL — `codeGlyph is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/apps/weather/weather-utils.ts`:

```ts
/** WMO weather code → glyph. Night variants only differ where the sun appears. */
export function codeGlyph(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? '☀' : '☾';
  if (code <= 2) return isDay ? '⛅' : '☾';
  if (code === 3) return '☁';
  if (code === 45 || code === 48) return '🌫';
  if (code >= 51 && code <= 67) return '🌧';
  if (code >= 71 && code <= 77) return '❄';
  if (code >= 80 && code <= 82) return '🌧';
  if (code === 85 || code === 86) return '🌨';
  if (code >= 95) return '⛈';
  return '☁';
}

export function conditionLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code === 85 || code === 86) return 'Snow Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function compass(bearing: number): string {
  const i = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return COMPASS_POINTS[i];
}

/** The canonical page-id list lives in `src/shared/schemas/app.weather.ts`
 *  (Task 4) because zod needs it to build the enum, and `src/shared` must not
 *  import from `src/apps`. Do not redeclare it here — import `WeatherPageId`
 *  from the schema instead. */

/** Value→colour ramps, one per metric dial. */
export const RAMPS: Record<string, ColorStop[]> = {
  temp: [
    [-20, '#4a7fd4'], [0, '#6fa8dc'], [10, '#8fd3c7'],
    [20, '#f0d264'], [28, '#f0913c'], [36, '#e05a3c'],
  ],
  precip: [[0, '#3a3f4a'], [30, '#4d8fd1'], [70, '#3a6fd8'], [100, '#2b4fc4']],
  wind: [[0, '#4a5560'], [15, '#6fbfa8'], [35, '#f0c04a'], [60, '#e0693c']],
  uv: [[0, '#4a5560'], [3, '#5fbf5f'], [6, '#f0c04a'], [8, '#e0693c'], [11, '#a05ad0']],
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- weather-utils`
Expected: PASS — 21 tests.

- [ ] **Step 5: Commit**

```bash
git add src/apps/weather/weather-utils.ts src/apps/weather/weather-utils.test.ts
git commit -m "feat(weather): add condition glyphs, compass and colour ramps"
```

---

### Task 4: Update the weather config schema

**Files:**
- Modify: `src/shared/schemas/app.weather.ts`
- Test: `src/shared/registry-coherence.test.ts` (existing — must keep passing)

`forecastDays` drove the old 3-day strip, which no longer exists. It is replaced by `pages` (which dials are enabled) and `idleReturnSeconds`. Zod strips unknown keys, so any `fleet.json` still carrying `forecastDays` parses cleanly and silently drops it — no migration step required.

- [ ] **Step 1: Write the failing test**

Create `src/shared/schemas/app.weather.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { weatherAppSchema } from './app.weather';

describe('weatherAppSchema', () => {
  it('defaults to all six pages enabled', () => {
    const cfg = weatherAppSchema.parse({});
    expect(cfg.pages).toEqual(['now', 'temp', 'conditions', 'precip', 'wind', 'uv']);
    expect(cfg.unit).toBe('celsius');
    expect(cfg.location).toBe('');
    expect(cfg.idleReturnSeconds).toBe(60);
  });

  it('accepts a trimmed page list', () => {
    const cfg = weatherAppSchema.parse({ pages: ['now', 'temp', 'precip'] });
    expect(cfg.pages).toEqual(['now', 'temp', 'precip']);
  });

  it('rejects an unknown page id', () => {
    expect(weatherAppSchema.safeParse({ pages: ['now', 'moon'] }).success).toBe(false);
  });

  it('drops the retired forecastDays key', () => {
    const cfg = weatherAppSchema.parse({ forecastDays: 4 }) as Record<string, unknown>;
    expect(cfg.forecastDays).toBeUndefined();
  });

  it('treats idleReturnSeconds 0 as a valid disable', () => {
    expect(weatherAppSchema.parse({ idleReturnSeconds: 0 }).idleReturnSeconds).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- app.weather`
Expected: FAIL — `expected undefined to equal [ 'now', 'temp', ... ]` (no `pages` field yet).

- [ ] **Step 3: Write the implementation**

Replace `src/shared/schemas/app.weather.ts`:

```ts
import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const WEATHER_PAGE_ENUM = ['now', 'temp', 'conditions', 'precip', 'wind', 'uv'] as const;

export const weatherAppSchema = z.object({
  location: z.string().default(''),
  unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  pages: z.array(z.enum(WEATHER_PAGE_ENUM)).min(1).default([...WEATHER_PAGE_ENUM]),
  idleReturnSeconds: z.number().int().min(0).max(600).default(60),
});

export const weatherAppMeta: FieldMetaMap = {
  location: {
    description: 'City name (e.g. "Montreal") or "lat,lon". Falls back to env if blank.',
    placeholder: 'Montreal',
  },
  unit: {},
  pages: {
    description: 'Which pages the vertical swipe cycles through, in order. "now" is the resting page.',
  },
  idleReturnSeconds: {
    min: 0,
    max: 600,
    step: 10,
    description: 'Seconds of no touch before returning to the Now page. 0 disables.',
  },
};

export type WeatherAppConfig = z.infer<typeof weatherAppSchema>;

/** Canonical page-id type. `src/apps/weather/*` imports this rather than
 *  redeclaring the list — `src/shared` must never import from `src/apps`. */
export type WeatherPageId = (typeof WEATHER_PAGE_ENUM)[number];
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — the new `app.weather` tests plus the existing registry-coherence, navigation and time-window suites. Registry coherence is unaffected: `weather` already appears in `ALL_KIOSK_APP_IDS` (`src/shared/capabilities.ts:24`) and `app.weather` is already in `SCHEMAS`.

- [ ] **Step 5: Commit**

```bash
git add src/shared/schemas/app.weather.ts src/shared/schemas/app.weather.test.ts
git commit -m "feat(weather): replace forecastDays with pages and idleReturnSeconds config"
```

---

### Task 5: Location resolution and the data hook

**Files:**
- Create: `src/apps/weather/weather-api.ts`
- Create: `src/apps/weather/weather-api.test.ts`
- Create: `src/apps/weather/useWeather.ts`

> **Revised during execution.** These functions were originally planned as an append to `weather-utils.ts`. A Task 3 domain review flagged that file drifting toward an "everything module" (time parsing + geometry + colour + domain models + presentation), and URL building is a network-shape concern rather than pure math. Splitting here costs less than splitting later.

- [ ] **Step 1: Write the failing test**

Create `src/apps/weather/weather-api.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCoords, buildForecastUrl } from './weather-api';

describe('parseCoords', () => {
  it('reads a "lat,lon" pair', () => {
    expect(parseCoords('45.5,-73.58')).toEqual({ lat: 45.5, lon: -73.58 });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseCoords(' 45.5 , -73.58 ')).toEqual({ lat: 45.5, lon: -73.58 });
  });

  it('returns null for a city name', () => {
    expect(parseCoords('Montreal')).toBeNull();
  });

  it('returns null for out-of-range values', () => {
    expect(parseCoords('91,0')).toBeNull();
    expect(parseCoords('0,181')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseCoords('')).toBeNull();
  });
});

describe('buildForecastUrl', () => {
  it('requests every field the dials need in one call', () => {
    const url = buildForecastUrl({ lat: 45.5, lon: -73.58 }, 'celsius');
    expect(url).toContain('latitude=45.5');
    expect(url).toContain('longitude=-73.58');
    expect(url).toContain('temperature_unit=celsius');
    for (const field of [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
      'precipitation_probability', 'wind_speed_10m', 'wind_gusts_10m',
      'uv_index', 'weather_code', 'is_day',
    ]) {
      expect(url).toContain(field);
    }
    expect(url).toContain('sunrise');
    expect(url).toContain('sunset');
    expect(url).toContain('forecast_days=2');
  });

  it('honours the fahrenheit unit', () => {
    expect(buildForecastUrl({ lat: 0, lon: 0 }, 'fahrenheit')).toContain('temperature_unit=fahrenheit');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- weather-utils`
Expected: FAIL — `parseCoords is not a function`.

- [ ] **Step 3: Write the implementation**

Create `src/apps/weather/weather-api.ts`:

```ts
export interface Coords { lat: number; lon: number }

export function parseCoords(raw: string): Coords | null {
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const lat = Number(parts[0].trim());
  const lon = Number(parts[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

const HOURLY_FIELDS = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
  'precipitation_probability', 'wind_speed_10m', 'wind_gusts_10m',
  'uv_index', 'weather_code', 'is_day',
].join(',');

const CURRENT_FIELDS = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'weather_code',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'uv_index', 'precipitation_probability', 'is_day',
].join(',');

const DAILY_FIELDS = 'temperature_2m_max,temperature_2m_min,sunrise,sunset';

/** One request covers all five dials plus the Now page. Open-Meteo is keyless,
 *  so this runs from the kiosk with no server proxy. */
export function buildForecastUrl(c: Coords, unit: 'celsius' | 'fahrenheit'): string {
  const params = new URLSearchParams({
    latitude: String(c.lat),
    longitude: String(c.lon),
    current: CURRENT_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
    timezone: 'auto',
    forecast_days: '2',
    temperature_unit: unit,
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function buildGeocodeUrl(name: string): string {
  const params = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' });
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- weather-api`
Expected: PASS — 7 tests in the new file. Then run the full `npm test` and confirm the total rose by 7 with no existing suite broken.

- [ ] **Step 5: Write the hook**

Create `src/apps/weather/useWeather.ts`:

```ts
import { useEffect, useState } from 'react';
import { buildForecastUrl, buildGeocodeUrl, parseCoords, type Coords } from './weather-api';
import { parseForecast, type WeatherModel } from './weather-utils';

const GEO_CACHE_KEY = 'superclock.weather.geo';
const REFRESH_MS = 15 * 60 * 1000;

async function resolveLocation(location: string): Promise<{ coords: Coords; label: string }> {
  const trimmed = location.trim();

  if (trimmed) {
    const direct = parseCoords(trimmed);
    if (direct) return { coords: direct, label: '' };

    const cachedRaw = localStorage.getItem(GEO_CACHE_KEY);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (cached.query === trimmed) return { coords: cached.coords, label: cached.label };
      } catch {
        localStorage.removeItem(GEO_CACHE_KEY);
      }
    }

    const res = await fetch(buildGeocodeUrl(trimmed));
    if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
    const json = await res.json();
    const hit = json.results?.[0];
    if (!hit) throw new Error(`No location matched "${trimmed}"`);
    const resolved = {
      coords: { lat: hit.latitude, lon: hit.longitude },
      label: String(hit.name),
    };
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ query: trimmed, ...resolved }));
    return resolved;
  }

  // Legacy fallback so devices still on env vars keep working until their
  // fleet config carries a location.
  const lat = import.meta.env.VITE_WEATHER_LAT;
  const lon = import.meta.env.VITE_WEATHER_LON;
  if (!lat || !lon) throw new Error('No weather location configured');
  return { coords: { lat: Number(lat), lon: Number(lon) }, label: '' };
}

export interface WeatherState {
  model: WeatherModel | null;
  label: string;
  offline: boolean;
}

/** Fetches once on mount, then refreshes every 15 minutes while the app is
 *  active. Background apps must not tick — a kiosk runs for weeks. */
export function useWeather(location: string, unit: 'celsius' | 'fahrenheit', isActive: boolean): WeatherState {
  const [model, setModel] = useState<WeatherModel | null>(null);
  const [label, setLabel] = useState('');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { coords, label: resolved } = await resolveLocation(location);
        const res = await fetch(buildForecastUrl(coords, unit));
        if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setModel(parseForecast(json, new Date()));
        setLabel(resolved);
        setOffline(false);
      } catch (err) {
        if (cancelled) return;
        console.warn('Weather fetch failed:', (err as Error).message);
        setOffline(true);
      }
    }

    load();
    if (!isActive) return () => { cancelled = true; };

    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [location, unit, isActive]);

  return { model, label, offline };
}
```

- [ ] **Step 6: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds (`tsc -b` clean).

- [ ] **Step 7: Commit**

```bash
git add src/apps/weather/useWeather.ts src/apps/weather/weather-api.ts src/apps/weather/weather-api.test.ts
git commit -m "feat(weather): add location resolution and the single-request data hook"
```

---

### Task 6: The Dial component

**Files:**
- Create: `src/apps/weather/Dial.tsx`

There are no component tests in this repo (Vitest runs in a node environment; there is no jsdom or testing-library). Verification for this task is visual, via the dev server.

- [ ] **Step 1: Write the component**

Create `src/apps/weather/Dial.tsx`:

```tsx
import { polar, ringSlots, type HourSample } from './weather-utils';

const C = 500;
const R_HOURS = 388;
const R_VALUES = 278;

export interface DialProps {
  hours: HourSample[];
  nowHour: number;
  /** Inner-ring label for one hour. */
  valueOf: (h: HourSample) => string;
  /** Inner-ring colour for one hour. */
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
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/weather/Dial.tsx
git commit -m "feat(weather): add the shared radial hour dial component"
```

---

### Task 7: The Now page

**Files:**
- Create: `src/apps/weather/NowPage.tsx`

- [ ] **Step 1: Write the component**

Create `src/apps/weather/NowPage.tsx`:

```tsx
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
      <defs>
        <radialGradient id="wx-sky" cx="50%" cy="18%" r="95%">
          <stop offset="0%" stopColor={daylight ? '#5b93c9' : '#1c2740'} />
          <stop offset="55%" stopColor={daylight ? '#28527f' : '#111a2c'} />
          <stop offset="100%" stopColor="#080d18" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={500} fill="url(#wx-sky)" />

      <path d={dayArcPath()} fill="none" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={5} />
      <circle cx={sun.x} cy={sun.y} r={26} fill={daylight ? '#ffe9a8' : '#dfe6f2'} />

      <text x={C} y={196} textAnchor="middle" dominantBaseline="central"
            fontSize={34} fill="#ffffff" fillOpacity={0.72}>
        {label ? `⌖ ${label.toUpperCase()} · ${hhmm}` : hhmm}
      </text>

      <text x={C} y={412} textAnchor="middle" dominantBaseline="central"
            fontSize={230} fontWeight={600} fill="#ffffff">
        {model.current.temp}°
      </text>

      <text x={C} y={560} textAnchor="middle" dominantBaseline="central"
            fontSize={44} fill="#ffffff">
        {conditionLabel(model.current.code)}
      </text>
      <text x={C} y={614} textAnchor="middle" dominantBaseline="central"
            fontSize={34} fill="#ffffff" fillOpacity={0.7}>
        {`H ${model.today.high}°     L ${model.today.low}°`}
      </text>

      <text x={112} y={520} textAnchor="middle" fontSize={26} fill="#ffffff" fillOpacity={0.45}>
        {fmt(model.today.sunriseMin)}
      </text>
      <text x={888} y={520} textAnchor="middle" fontSize={26} fill="#ffffff" fillOpacity={0.45}>
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
                  fill="#ffffff" fillOpacity={0.45}>{k}</text>
            <text x={x} y={812} textAnchor="middle" fontSize={34} fill="#ffffff">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/weather/NowPage.tsx
git commit -m "feat(weather): add the ambient Now page with a rim day-arc"
```

---

### Task 8: Wire the pages together in WeatherApp

**Files:**
- Modify: `src/apps/weather/WeatherApp.tsx` (full rewrite)

- [ ] **Step 1: Write the component**

Replace `src/apps/weather/WeatherApp.tsx` entirely:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { weatherAppSchema, type WeatherPageId } from '../../shared/schemas/app.weather';
import { useWeather } from './useWeather';
import Dial, { type DialProps } from './Dial';
import NowPage from './NowPage';
import {
  RAMPS, codeGlyph, compass, conditionLabel, rampColor,
  type HourSample, type WeatherModel,
} from './weather-utils';

// The explicit return type matters: without it TypeScript infers a union of
// six differently-shaped objects (only some carry `valueSize`), and spreading
// that union into <Dial {...dial} /> fails to type-check.
function dialFor(page: WeatherPageId, m: WeatherModel): DialProps | null {
  const nowHour = m.current.hour;
  const base = { hours: m.hours, nowHour };
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
      const peak = m.hours.reduce((a, b) => (b.precipProb > a.precipProb ? b : a), m.hours[0]);
      return {
        ...base,
        valueOf: (h: HourSample) => `${h.precipProb}%`,
        colorOf: (h: HourSample) => rampColor(RAMPS.precip, h.precipProb),
        valueSize: 38,
        centre: `${m.current.precipProb}%`,
        sub: 'Chance now',
        caption: peak.precipProb > 0
          ? `Peaks at ${peak.precipProb}% around ${String(peak.hour).padStart(2, '0')}:00`
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
        sub: m.current.uv <= 2 ? 'Low' : m.current.uv <= 5 ? 'Moderate' : m.current.uv <= 7 ? 'High' : 'Very High',
        caption: `Peak today ${Math.max(...m.hours.map((h) => h.uv))}`,
      };
    default:
      return null;
  }
}

export default function WeatherApp({ isActive, config }: AppProps) {
  // safeParse, not parse: a malformed fleet config must not white-screen a
  // kiosk. Fall back to schema defaults and keep rendering.
  const cfg = useMemo(() => {
    const result = weatherAppSchema.safeParse(config ?? {});
    if (result.success) return result.data;
    console.warn('Invalid weather config, using defaults:', result.error.message);
    return weatherAppSchema.parse({});
  }, [config]);
  const pages = cfg.pages;

  const [page, setPage] = useState(0);
  const [now, setNow] = useState(new Date());
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  const { model, label, offline } = useWeather(cfg.location, cfg.unit, isActive);

  // Only HH:MM is rendered — returning the previous state when the minute is
  // unchanged skips the re-render, so this ticks the tree once a minute
  // instead of once a second (real heat on a Pi).
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setNow((prev) => {
        const n = new Date();
        return n.getMinutes() === prev.getMinutes() && n.getHours() === prev.getHours() ? prev : n;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isActive]);

  // Vertical swipe cycles pages; swipe-down on page 0 falls through to the
  // shell's default gesture. Same mechanism as HabitsApp.
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    setVerticalSwipeCallback((dir) => {
      if (dir === 'up') {
        setPage((p) => Math.min(p + 1, pages.length - 1));
      } else if (page > 0) {
        setPage((p) => Math.max(p - 1, 0));
      } else {
        showGrid();
      }
    });
    return () => setVerticalSwipeCallback(null);
  }, [isActive, page, pages.length, setVerticalSwipeCallback, showGrid]);

  // A kiosk never swipes itself home. Without this, checking the UV dial on
  // Tuesday leaves UV on screen until Friday.
  useEffect(() => {
    if (!isActive || page === 0 || cfg.idleReturnSeconds === 0) return;
    const id = setTimeout(() => setPage(0), cfg.idleReturnSeconds * 1000);
    return () => clearTimeout(id);
  }, [isActive, page, cfg.idleReturnSeconds]);

  // A trimmed page list can strand the index past the end.
  useEffect(() => {
    setPage((p) => Math.min(p, pages.length - 1));
  }, [pages.length]);

  if (!model) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <span className="font-mono text-[3vmin] text-white/40">
          {offline ? 'weather offline' : 'loading…'}
        </span>
      </div>
    );
  }

  const current = pages[page];
  const dial = current === 'now' ? null : dialFor(current, model);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {current === 'now'
        ? <NowPage model={model} label={label} now={now} />
        : dial && <Dial {...dial} />}

      {offline && (
        <span className="absolute left-1/2 top-[12%] -translate-x-1/2 font-mono text-[2.4vmin] text-white/30">
          offline
        </span>
      )}

      <div className="pointer-events-none absolute bottom-[3.5%] left-1/2 flex -translate-x-1/2 gap-2">
        {pages.map((id, i) => (
          <div
            key={id}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${i === page ? 'bg-white' : 'bg-white/25'}`}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: no errors. If ESLint's react-hooks Compiler ruleset flags a dependency, fix the dependency array — do not add a disable comment.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites.

- [ ] **Step 4: Verify in the browser**

Start the dev server via the `preview_start` tool (never `npm run dev` in Bash) using the `.claude/launch.json` entry, then:
1. Navigate to the kiosk and open the Weather app.
2. Drive pages from the console — the preview tab is backgrounded, so gestures don't fire: `window.__nav.getState()` exposes the navigation store.
3. Confirm all six pages render, the current-hour pill lands on the right clock position, and the page dots track.

Expected: six pages, hour labels at true clock positions, no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/apps/weather/WeatherApp.tsx
git commit -m "feat(weather): six-page swipe stack with dials, idle return and config-driven pages"
```

---

### Task 9: Retire the VITE_WEATHER_* fallback path

**Files:**
- Modify: `src/apps/weather/useWeather.ts`
- Modify: `.env.example` — delete the whole Weather block, lines 9–14 (the `# Weather app — Open-Meteo lat/lon…` comment, `VITE_WEATHER_LAT=`, `VITE_WEATHER_LON=`, `VITE_WEATHER_TZ=auto`, the `# Set to \`fahrenheit\`…` comment, and `VITE_WEATHER_UNIT=`). Location and unit come from fleet config now; timezone is resolved by Open-Meteo's `timezone=auto`.

Do this only once a real device has been confirmed working with a fleet-config location — the fallback is the safety net until then.

- [ ] **Step 1: Set the location in fleet config**

In the admin UI (`/admin` on the admin host), set the weather app's `location` for the target device to `Montreal`, save, and confirm the push succeeded.

- [ ] **Step 2: Confirm the kiosk picks it up**

The kiosk polls `GET /api/device/config` every 5s. Reload the kiosk and confirm the Now page header shows `⌖ MONTREAL · HH:MM`.

- [ ] **Step 3: Remove the fallback**

In `src/apps/weather/useWeather.ts`, replace the trailing legacy block in `resolveLocation`:

```ts
  // Legacy fallback so devices still on env vars keep working until their
  // fleet config carries a location.
  const lat = import.meta.env.VITE_WEATHER_LAT;
  const lon = import.meta.env.VITE_WEATHER_LON;
  if (!lat || !lon) throw new Error('No weather location configured');
  return { coords: { lat: Number(lat), lon: Number(lon) }, label: '' };
```

with:

```ts
  throw new Error('No weather location configured — set it in the admin panel');
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/apps/weather/useWeather.ts .env.example
git commit -m "refactor(weather): drop VITE_WEATHER_* env fallback in favour of fleet config"
```

---

### Task 10: Deploy to fastclock and check it on glass

**Files:** none — verification only.

The open design questions can only be answered on the real device: (a) does the inner value ring read from across the room, and (b) does the UV page earn its slot?

- [ ] **Step 1: Deploy**

```bash
scripts/deploy.sh nickv2026@fastclock
```

Note: `deploy.sh` builds from the **local** working tree, so make sure the branch is the one you intend to ship.

- [ ] **Step 2: Force the kiosk to reload**

```bash
ssh nickv2026@fastclock 'pkill -TERM chromium'
```

- [ ] **Step 3: Check it from across the room**

Walk to normal viewing distance and check, in order:
1. Is the Now page readable at a glance?
2. On the temp dial, can you read the inner ring values, or only the centre?
3. Does the current-hour pill land where the real clock hand would be?
4. Leave it on the UV page and confirm it returns to Now after 60s.

- [ ] **Step 4: Record the outcome**

If the inner ring is unreadable at distance, the fix is structural, not cosmetic — reduce to 6 alternating hours, or show values only for the hours near now. Note the decision in the plan file before changing code.
