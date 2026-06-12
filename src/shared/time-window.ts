// Shared HH:MM time-window evaluation for schedule features (sleep, night).
// Used by BOTH the kiosk client (theme class) and the Express server
// (display-adapter brightness/power) — keep it dependency-free.

export interface TimeWindow {
  start: string; // 24h "HH:MM" — window opens
  end: string; // 24h "HH:MM" — window closes (may be past midnight)
}

function toMinutes(hhmm: unknown): number | null {
  if (typeof hhmm !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// True when `now` falls inside [start, end), handling windows that wrap past
// midnight (e.g. 21:00 → 07:00). Missing window, malformed times, or
// start === end → false (window never active) — mirrors the sleep-schedule
// behavior this was extracted from (server/display-adapter.ts).
export function isWithinWindow(
  window: TimeWindow | undefined,
  now: Date
): boolean {
  if (!window) return false;
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  if (start === null || end === null || start === end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}
