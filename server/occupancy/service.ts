// Desk-occupancy logger: folds radar presence transitions into per-day
// session logs so the Time Tracking app can show real "at desk" time and
// daily rhythm. Persists to config/occupancy.json (same atomic-write
// pattern as fleet-store). Counts nothing when the radar is unavailable.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getRadarSnapshot, subscribeRadar } from '../radar/service';
import type { OccupancySummary } from '../../src/shared/occupancy';

const OCCUPANCY_PATH = join(process.cwd(), 'config', 'occupancy.json');
const LOG_PREFIX = '[occupancy]';
// A brief presence dropout (walking across the room's edge, radar flicker)
// re-opens the previous session instead of starting a new one.
const MERGE_GAP_MS = 60_000;
// Debounce disk writes; sessions also flush when they close.
const SAVE_DELAY_MS = 30_000;
const KEEP_DAYS = 30;

interface OccupancySession {
  start: string; // ISO
  end: string; // ISO
}

interface DayLog {
  date: string; // local YYYY-MM-DD
  sessions: OccupancySession[];
}

interface OccupancyFile {
  days: DayLog[];
}

let days: DayLog[] = [];
let openSince: number | null = null;
let lastPresent = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function localDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayFor(date: string): DayLog {
  let day = days.find((d) => d.date === date);
  if (!day) {
    day = { date, sessions: [] };
    days.push(day);
    days.sort((a, b) => a.date.localeCompare(b.date));
    if (days.length > KEEP_DAYS) days = days.slice(-KEEP_DAYS);
  }
  return day;
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persist();
  }, SAVE_DELAY_MS);
  saveTimer.unref?.();
}

async function persist(): Promise<void> {
  try {
    await mkdir(dirname(OCCUPANCY_PATH), { recursive: true });
    const tmp = `${OCCUPANCY_PATH}.${process.pid}.tmp`;
    const payload: OccupancyFile = { days };
    await writeFile(tmp, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    await rename(tmp, OCCUPANCY_PATH);
  } catch (err) {
    console.warn(`${LOG_PREFIX} persist failed (ignored): ${(err as Error).message}`);
  }
}

// Record [startMs, endMs) as sessions, split on local midnight boundaries.
function record(startMs: number, endMs: number): void {
  if (endMs <= startMs) return;
  let cursor = startMs;
  while (cursor < endMs) {
    const boundary = new Date(cursor);
    boundary.setHours(24, 0, 0, 0); // next local midnight
    const chunkEnd = Math.min(endMs, boundary.getTime());
    dayFor(localDate(cursor)).sessions.push({
      start: new Date(cursor).toISOString(),
      end: new Date(chunkEnd).toISOString(),
    });
    cursor = chunkEnd;
  }
  scheduleSave();
}

function onPresenceChanged(present: boolean, nowMs: number): void {
  if (present === lastPresent) return;
  lastPresent = present;

  if (present) {
    // Re-open the just-closed session when the gap was a flicker.
    const today = days.find((d) => d.date === localDate(nowMs));
    const last = today?.sessions[today.sessions.length - 1];
    if (last && nowMs - Date.parse(last.end) < MERGE_GAP_MS) {
      openSince = Date.parse(last.start);
      today.sessions.pop();
    } else {
      openSince = nowMs;
    }
  } else if (openSince !== null) {
    record(openSince, nowMs);
    openSince = null;
  }
}

export function initOccupancyService(): void {
  if (started) return;
  started = true;

  void (async () => {
    try {
      const raw = await readFile(OCCUPANCY_PATH, 'utf8');
      const parsed = JSON.parse(raw) as OccupancyFile;
      if (Array.isArray(parsed.days)) days = parsed.days.slice(-KEEP_DAYS);
      console.log(`${LOG_PREFIX} loaded ${days.length} day(s) of history`);
    } catch {
      // first run — nothing persisted yet
    }
  })();

  subscribeRadar((snapshot) => {
    const present = snapshot.available && snapshot.present === true;
    onPresenceChanged(present, Date.now());
  });
}

function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function getOccupancySummary(): OccupancySummary {
  const nowMs = Date.now();
  const today = localDate(nowMs);

  // Treat the open session as ending "now" for all aggregates.
  const sessionsFor = (date: string): Array<[number, number]> => {
    const stored = (days.find((d) => d.date === date)?.sessions ?? []).map(
      (s): [number, number] => [Date.parse(s.start), Date.parse(s.end)],
    );
    if (openSince !== null && localDate(nowMs) === date) {
      stored.push([Math.max(openSince, new Date(nowMs).setHours(0, 0, 0, 0)), nowMs]);
    }
    return stored;
  };

  const todaySessions = sessionsFor(today);
  const totalMs = todaySessions.reduce((sum, [s, e]) => sum + (e - s), 0);

  const hourlyMs = Array.from({ length: 24 }, (_, hour) => {
    const hourStart = new Date(nowMs);
    hourStart.setHours(hour, 0, 0, 0);
    const start = hourStart.getTime();
    return todaySessions.reduce(
      (sum, [s, e]) => sum + overlapMs(s, e, start, start + 3_600_000),
      0,
    );
  });

  const history: OccupancySummary['history'] = [];
  for (let back = 0; back < 7; back++) {
    const d = new Date(nowMs);
    d.setDate(d.getDate() - back);
    const date = localDate(d.getTime());
    const total = sessionsFor(date).reduce((sum, [s, e]) => sum + (e - s), 0);
    history.push({ date, totalMs: total });
  }

  const snapshot = getRadarSnapshot();
  return {
    date: today,
    totalMs,
    hourlyMs,
    history,
    live: {
      present: snapshot.available && snapshot.present === true,
      sinceMs: openSince,
    },
  };
}
