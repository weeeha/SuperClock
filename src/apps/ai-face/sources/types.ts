import type { AvatarActivity, AvatarExpression } from '../../../shared/ai-face-designs';

export interface AvatarState {
  activity: AvatarActivity;
  expression: AvatarExpression;
}

// The seam the main agent plugs into later (spec SP4), the same pattern as
// AgentProvider: the app only ever sees a source.
export interface AvatarStateSource {
  initial: AvatarState;
  subscribe(cb: (s: AvatarState) => void): () => void;
}
