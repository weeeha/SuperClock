// Fixture: must NOT trip NAV-2 — guarded cleanup on the back slot.
interface Store {
  getState(): { backCallback: unknown };
  setBackCallback(cb: (() => void) | null): void;
}
export function registerGood(store: Store) {
  const cb = () => {};
  store.setBackCallback(cb);
  return () => {
    if (store.getState().backCallback === cb) store.setBackCallback(null);
  };
}
