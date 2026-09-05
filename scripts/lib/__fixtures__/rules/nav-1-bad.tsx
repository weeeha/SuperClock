// Fixture: must trip NAV-1 — registers the shared slot and nulls it unconditionally.
type Slot = (cb: (() => void) | null) => void;
export function registerBad(setVerticalSwipeCallback: Slot) {
  setVerticalSwipeCallback(() => {});
  return () => setVerticalSwipeCallback(null);
}
