// Pure time maths and labels for alarms. Occurrences are built from local date
// fields, so the Date constructor resolves DST (a 02:30 alarm on a
// spring-forward night rings at 03:30).
import type { Alarm } from './alarm-store';

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function parseTime(time: string): { h: number; m: number } {
  const [h, m] = time.split(':').map(Number);
  return { h, m };
}

export function formatTime(h: number, m: number): string {
  return `${pad(h)}:${pad(m)}`;
}

export function clockText(epochMs: number): string {
  const d = new Date(epochMs);
  return formatTime(d.getHours(), d.getMinutes());
}

export function nextOccurrence(alarm: Alarm, now: Date): number | null {
  if (!alarm.enabled) return null;
  const { h, m } = parseTime(alarm.time);
  for (let d = 0; d <= 7; d++) {
    const c = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, m, 0, 0);
    if (c.getTime() <= now.getTime()) continue;
    if (alarm.days.length === 0 || alarm.days.includes(c.getDay())) return c.getTime();
  }
  return null;
}

export function nextAlarm(alarms: Alarm[], now: Date): { alarm: Alarm; at: number } | null {
  let best: { alarm: Alarm; at: number } | null = null;
  for (const alarm of alarms) {
    const at = nextOccurrence(alarm, now);
    if (at !== null && (!best || at < best.at)) best = { alarm, at };
  }
  return best;
}

export function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const key = sorted.join(',');
  if (sorted.length === 0) return 'Once';
  if (key === '0,1,2,3,4,5,6') return 'Every day';
  if (key === '1,2,3,4,5') return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  return sorted.map((d) => DAY_NAMES[d]).join(', ');
}

export function untilLabel(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

export function nextLabel(at: number, now: Date): string {
  const t = new Date(at);
  const dayDiff = Math.round(
    (Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86_400_000,
  );
  const when = dayDiff === 0 ? 'today' : dayDiff === 1 ? 'tomorrow' : DAY_NAMES[t.getDay()];
  return `${when} ${clockText(at)}`;
}

/** The ring dial: minutes move in 5-minute steps, hours in 1-hour steps, both wrapping. */
export function stepTime(time: string, mode: 'minutes' | 'hours', steps: number): string {
  const { h, m } = parseTime(time);
  if (mode === 'minutes') return formatTime(h, (((m + steps * 5) % 60) + 60) % 60);
  return formatTime((((h + steps) % 24) + 24) % 24, m);
}
