export const MIC_STATES = ['idle', 'listening', 'thinking', 'speaking'] as const;
export type MicState = (typeof MIC_STATES)[number];

export function nextMicState(s: MicState): MicState {
  return MIC_STATES[(MIC_STATES.indexOf(s) + 1) % MIC_STATES.length];
}
