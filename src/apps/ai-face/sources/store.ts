import type { AvatarState, AvatarStateSource } from './types';

// Bridges a source to useSyncExternalStore, so components never call
// setState from an effect (react-hooks v7 rejects that).
export function toExternalStore(source: AvatarStateSource) {
  let current: AvatarState = source.initial;
  return {
    subscribe(onChange: () => void) {
      return source.subscribe((s) => {
        current = s;
        onChange();
      });
    },
    getSnapshot: () => current,
  };
}
