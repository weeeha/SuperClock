// Fixture: must trip NAV-2 — the back slot nulled unconditionally.
type Slot = (cb: (() => void) | null) => void;
export function registerBad(setBackCallback: Slot) {
  setBackCallback(() => {});
  return () => setBackCallback(null);
}
