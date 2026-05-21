import { useState } from 'react';

/**
 * Monotonically-increasing rotation in degrees for an analog clock's second hand,
 * aligned to integer seconds (6° steps). Prevents the ~354° backward sweep that
 * occurs each minute when CSS transitions interpolate the wrap from second 59
 * (354°) back to second 0 (0°).
 *
 * Uses React's "storing information from previous renders" pattern: when the
 * `seconds` prop changes, we update state during render so the returned value
 * already reflects the wrap on the same frame.
 * https://react.dev/reference/react/useState#storing-information-from-previous-renders
 */
export function useContinuousSecondAngle(seconds: number): number {
  const [state, setState] = useState({ cumulative: 0, lastSec: seconds });

  if (seconds !== state.lastSec) {
    const wrapped = seconds < state.lastSec;
    const newCumulative = state.cumulative + (wrapped ? 360 : 0);
    setState({ cumulative: newCumulative, lastSec: seconds });
    return seconds * 6 + newCumulative;
  }

  return seconds * 6 + state.cumulative;
}
