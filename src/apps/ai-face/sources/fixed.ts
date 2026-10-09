import type { AvatarState, AvatarStateSource } from './types';

export function createFixedSource(state: AvatarState): AvatarStateSource {
  return {
    initial: state,
    subscribe(cb) {
      cb(state);
      return () => {};
    },
  };
}
