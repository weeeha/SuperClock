// Fixture: must trip NAV-1 — the guard exists only in prose:
// "null the slot only if useNavigation.getState().verticalSwipeCallback === cb".
type Slot = (cb: (() => void) | null) => void;
export function registerCommented(setVerticalSwipeCallback: Slot) {
  setVerticalSwipeCallback(() => {});
  return () => setVerticalSwipeCallback(null);
}
