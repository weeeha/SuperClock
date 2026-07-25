// Shared honest-data source for the Complications faces (Dark + Light).
//
// The habit tile binds READ-ONLY to the same localStorage the HabitsApp
// writes (`superclock-habits-v2`), and the habit list comes from the cached
// device config (same instance config HabitsApp receives), falling back to
// the schema default — so the ring shows real progress, never demo numbers.

import { useEffect, useState } from 'react';
import { habitsAppSchema } from '../../shared/schemas/app.habits';
import { loadLocalConfig } from '../../shared/local-config';

// Must match STORAGE_KEY in src/apps/habits/HabitsApp.tsx.
const HABITS_STORAGE_KEY = 'superclock-habits-v2';

export type HabitsToday = { done: number; total: number };

// Same id derivation as HabitsApp.habitsFromNames — ids are trimmed,
// lowercased names, deduped — so completion keys resolve identically.
function habitIds(names: string[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const id = name.trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readHabitsToday(todayStr: string): HabitsToday {
  const instance = loadLocalConfig()?.instances.find((i) => i.appId === 'habits');
  const parsed = habitsAppSchema.safeParse(instance?.config ?? {});
  const names = parsed.success ? parsed.data.habits : habitsAppSchema.parse({}).habits;
  const ids = habitIds(names);

  let completions: Record<string, boolean> = {};
  try {
    completions = JSON.parse(localStorage.getItem(HABITS_STORAGE_KEY) ?? '{}') as Record<
      string,
      boolean
    >;
  } catch {
    // Unreadable store — honestly report zero done rather than inventing data.
  }

  return {
    done: ids.filter((id) => completions[`${id}:${todayStr}`]).length,
    total: ids.length,
  };
}

// Reads once on mount (the face remounts whenever the user navigates back to
// it, which is the only way completions can have changed) and again when the
// local calendar day rolls over. No timers of its own — `time` comes from the
// face's existing useClockHands tick.
export function useHabitsToday(time: Date): HabitsToday {
  const todayStr = localDateStr(time);
  const [stats, setStats] = useState<HabitsToday>(() => readHabitsToday(todayStr));
  useEffect(() => {
    setStats(readHabitsToday(todayStr));
  }, [todayStr]);
  return stats;
}
