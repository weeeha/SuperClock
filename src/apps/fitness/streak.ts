// Three hearts per calendar month; one is lost for every day missed since
// the last completed workout. Seven's 7-month challenge and bankable pause
// days are deliberately not implemented — see the design doc.
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
}

export function emptyStreak(): StreakState {
  return { completions: {}, lastCompletedKey: null, hearts: HEARTS_PER_MONTH, monthKey: null };
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

function daysBetween(fromKey: string, to: Date): number {
  const [y, m, d] = fromKey.split('-').map(Number);
  const from = new Date(y, m - 1, d);
  const toMidnight = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toMidnight.getTime() - from.getTime()) / 86_400_000);
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

/** Charge a heart for each missed day, and refill on a new month. */
export function settleMissedDays(state: StreakState, now: Date): StreakState {
  const monthKey = toMonthKey(now);
  if (state.monthKey !== null && state.monthKey !== monthKey) {
    return { ...state, hearts: HEARTS_PER_MONTH, monthKey };
  }
  if (state.lastCompletedKey === null) {
    return { ...state, monthKey: state.monthKey ?? monthKey };
  }
  // A gap of 1 day means "yesterday" — nothing missed yet.
  const missed = Math.max(0, daysBetween(state.lastCompletedKey, now) - 1);
  if (missed === 0) return state;
  return { ...state, hearts: Math.max(0, state.hearts - missed) };
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
