// Three hearts per calendar month; one is lost for every day missed since
// the last completed workout. Seven's 7-month challenge and bankable pause
// days are deliberately not implemented — see the design doc.
//
// `settleMissedDays` runs at mount AND on every day-rollover tick (a kiosk
// can sit on this screen for weeks and must notice midnight), so it has to
// be idempotent — re-running it for the same `now` must never re-charge a
// gap it already accounted for. `settledThroughKey` is the watermark that
// makes that true: it marks "days strictly before this key have already had
// their miss-status charged," and it always advances to today on return, so
// the next call's window starts exactly where this one left off.
//
// Everything above `loadStreak`/`saveStreak` is pure and takes an explicit
// Date, because Vitest runs in the node environment where there is no
// `localStorage` to stub.

export const HEARTS_PER_MONTH = 3;
const STORAGE_KEY = 'superclock-fitness-streak-v1';

export interface StreakState {
  /** Local date keys (YYYY-MM-DD) of completed workouts. */
  completions: Record<string, boolean>;
  lastCompletedKey: string | null;
  hearts: number;
  /** Month the current hearts belong to (YYYY-MM). */
  monthKey: string | null;
  /** Days strictly before this key have had their miss-status charged
   *  already. Makes settleMissedDays idempotent — it can run on every
   *  day-rollover tick without re-charging a gap it already accounted for. */
  settledThroughKey: string | null;
}

export function emptyStreak(): StreakState {
  return {
    completions: {},
    lastCompletedKey: null,
    hearts: HEARTS_PER_MONTH,
    monthKey: null,
    settledThroughKey: null,
  };
}

// LOCAL calendar date, never toISOString(): mixing the two shifts day keys
// by one in any UTC+ timezone, which lights up the wrong day.
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toMonthKey(d: Date): string {
  return toDateKey(d).slice(0, 7);
}

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + n));
}

export function recordCompletion(state: StreakState, now: Date): StreakState {
  const key = toDateKey(now);
  const monthKey = toMonthKey(now);
  return {
    ...state,
    completions: { ...state.completions, [key]: true },
    lastCompletedKey: key,
    monthKey: state.monthKey ?? monthKey,
  };
}

/**
 * Charge a heart for each missed day since the watermark, and refill on a
 * new month. Idempotent for a given `now` — see the module comment.
 */
export function settleMissedDays(state: StreakState, now: Date): StreakState {
  const todayKey = toDateKey(now);
  const monthKey = toMonthKey(now);

  // Month change wins and forgives: reset hearts and advance the watermark
  // to today, so the old month's already-forgiven gap is never charged on
  // a later call.
  if (state.monthKey !== null && state.monthKey !== monthKey) {
    return { ...state, hearts: HEARTS_PER_MONTH, monthKey, settledThroughKey: todayKey };
  }

  // This fallback only matters for the very first settle call ever made
  // (no watermark yet): it anchors the window to the day after the most
  // recent completion, or to today if nothing has ever been completed.
  // Every subsequent call has a watermark and never touches this branch.
  const windowStart =
    state.settledThroughKey ?? (state.lastCompletedKey !== null ? addDays(state.lastCompletedKey, 1) : todayKey);

  // Half-open [windowStart, todayKey): today isn't over, so not having
  // worked out yet today is not a miss.
  let missed = 0;
  for (let cursor = windowStart; cursor < todayKey; cursor = addDays(cursor, 1)) {
    if (!state.completions[cursor]) missed++;
  }

  return {
    ...state,
    hearts: Math.max(0, state.hearts - missed),
    settledThroughKey: todayKey,
    monthKey: state.monthKey ?? monthKey,
  };
}

/** Settle first, then record. Exported as one operation because doing these
 *  in the wrong order silently forgives a day-spanning gap, and a caller has
 *  no way to know that from the individual signatures. */
export function completeWorkout(state: StreakState, now: Date): StreakState {
  return recordCompletion(settleMissedDays(state, now), now);
}

export function loadStreak(): StreakState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyStreak(), ...(JSON.parse(raw) as StreakState) } : emptyStreak();
  } catch {
    return emptyStreak();
  }
}

export function saveStreak(state: StreakState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A full or disabled localStorage must not break the workout.
  }
}
