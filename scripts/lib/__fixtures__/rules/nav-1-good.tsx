// Fixture: must NOT trip NAV-1 — the guarded cleanup clears only its own registration.
interface Store {
  getState(): { verticalSwipeCallback: unknown };
  setVerticalSwipeCallback(cb: (() => void) | null): void;
}
export function registerGood(store: Store) {
  const cb = () => {};
  store.setVerticalSwipeCallback(cb);
  return () => {
    if (store.getState().verticalSwipeCallback === cb) store.setVerticalSwipeCallback(null);
  };
}
