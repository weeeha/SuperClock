// Pure date logic for the Countdown app. Days are counted between calendar
// dates via Date.UTC day numbers, never by dividing a local-time gap by
// 86 400 000: across a DST change a local day is 23 or 25 hours long.
import type { CountdownAppConfig } from '../../shared/schemas/app.countdown';

export interface LocalDate {
  y: number;
  m: number;
  d: number;
}

export type RingView = { fraction: number; spent: boolean } | { missingStart: true };

export type CountdownView =
  | { kind: 'not-set-up' }
  | { kind: 'until'; unit: 'days' | 'weeks'; value: number; remainderDays: number; ring: RingView | null }
  | { kind: 'today'; ring: RingView | null }
  | { kind: 'since'; unit: 'days' | 'weeks'; value: number; remainderDays: number; ring: RingView | null };

const DAY_MS = 86_400_000;
/** From here the number would need five digits, so it switches to weeks. */
const WEEKS_FROM_DAYS = 10_000;

/** 'YYYY-MM-DD' that names a real calendar date, else null. */
export function parseDate(s: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function localToday(now: Date): LocalDate {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

function dayNumber(x: LocalDate): number {
  return Math.round(Date.UTC(x.y, x.m - 1, x.d) / DAY_MS);
}

function split(days: number, style: CountdownAppConfig['style']) {
  if (style === 'weeks' || days >= WEEKS_FROM_DAYS) {
    return { unit: 'weeks' as const, value: Math.floor(days / 7), remainderDays: days % 7 };
  }
  return { unit: 'days' as const, value: days, remainderDays: 0 };
}

function ringFor(config: CountdownAppConfig, today: LocalDate, target: LocalDate, delta: number): RingView | null {
  if (config.style !== 'progress-ring') return null;
  if (delta <= 0) return { fraction: 1, spent: true };
  const start = parseDate(config.startDate);
  if (!start || dayNumber(start) >= dayNumber(target)) return { missingStart: true };
  const span = dayNumber(target) - dayNumber(start);
  const elapsed = dayNumber(today) - dayNumber(start);
  return { fraction: Math.min(1, Math.max(0, elapsed / span)), spent: false };
}

export function countdownState(today: LocalDate, config: CountdownAppConfig): CountdownView {
  const target = parseDate(config.targetDate);
  if (!target) return { kind: 'not-set-up' };
  const delta = dayNumber(target) - dayNumber(today);
  const ring = ringFor(config, today, target, delta);
  if (delta === 0) return { kind: 'today', ring };
  const parts = split(Math.abs(delta), config.style);
  return delta > 0 ? { kind: 'until', ...parts, ring } : { kind: 'since', ...parts, ring };
}

/** Milliseconds from now to the next local midnight; the Date constructor
 *  resolves DST, so this is 23 or 25 hours on transition days. */
export function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
