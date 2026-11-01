// A running session asks the idle return to wait. Taps already count as
// activity, but a 25-minute focus block or a workout's work interval is five
// minutes without touching the glass, and the home return would pull the
// person off the app mid-session. The hold is a single slot, like
// verticalSwipeCallback, with the same guarded release: SwipeContainer's
// popLayout keeps the exiting app mounted after the next one registers, so an
// app only releases a hold it still owns.
import { useEffect } from 'react';
import { useNavigation } from '../navigation';

export function useHomeHold(holder: string, active: boolean): void {
  const setHomeHold = useNavigation((s) => s.setHomeHold);
  useEffect(() => {
    if (!active) return;
    setHomeHold(holder);
    return () => {
      if (useNavigation.getState().homeHold === holder) setHomeHold(null);
    };
  }, [holder, active, setHomeHold]);
}
