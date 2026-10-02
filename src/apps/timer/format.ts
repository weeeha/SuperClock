const pad = (n: number) => String(n).padStart(2, '0');

/** The readout. Partial seconds round up, so it reads 00:00 only at the end. */
export function formatMMSS(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** A duration in a caption: "5:00", "1:30". */
export function formatMinutes(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** Local wall-clock time for "Done at 12:41". */
export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
