// Wire type for /api/occupancy — the radar-derived desk occupancy summary
// consumed by the Time Tracking app. Keep dependency-free.

export interface OccupancySummary {
  date: string; // local YYYY-MM-DD
  totalMs: number; // at-desk time today
  hourlyMs: number[]; // 24 buckets, local hours
  history: Array<{ date: string; totalMs: number }>; // most recent first, incl. today
  live: { present: boolean; sinceMs: number | null };
}
