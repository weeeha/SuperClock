// Fixture: must NOT trip KIO-1 — the timer is gated on isActive.
export function tickWhileShown(isActive: boolean, onTick: () => void) {
  if (!isActive) return () => {};
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
