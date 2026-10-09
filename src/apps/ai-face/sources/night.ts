import type { AvatarState } from './types';

export function applyNight(state: AvatarState, isNight: boolean, sleepAtNight: boolean): AvatarState {
  return isNight && sleepAtNight ? { activity: 'sleeping', expression: state.expression } : state;
}
