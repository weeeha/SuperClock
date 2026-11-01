// The swipe cycle's bookkeeping, apart from ClockApp so that file exports
// only components (react-refresh). The configured face is where the cycle
// starts, not a lock (2026-11-01: fastclock's Rally instance pins faceId
// through the playlist and could never swipe to another face).
import { FACE_COMPONENTS, SWIPE_CYCLE_ORDER } from './face-components';

/** Where the swipe cycle starts for a configured face: its place in
 *  SWIPE_CYCLE_ORDER, or the first face when nothing (or a face this build
 *  does not know) is configured. */
export function startIndexFor(faceId: string | undefined): number {
  const component = faceId ? FACE_COMPONENTS[faceId] : undefined;
  const index = component ? SWIPE_CYCLE_ORDER.indexOf(component) : -1;
  return index >= 0 ? index : 0;
}

/** The registry id of the face at a cycle position, for data-face and tests. */
export function faceIdAt(index: number): string | undefined {
  const component = SWIPE_CYCLE_ORDER[index];
  return Object.keys(FACE_COMPONENTS).find((id) => FACE_COMPONENTS[id] === component);
}
