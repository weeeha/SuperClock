// Fixture: must trip KIO-1 — a timer with no gate anywhere in the file.
export function tickForever(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
