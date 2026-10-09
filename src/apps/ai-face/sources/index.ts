import type { AiFaceAppConfig } from '../../../shared/schemas/app.ai-face';
import { createDemoSource } from './demo';
import { createFixedSource } from './fixed';
import type { AvatarStateSource } from './types';

export type { AvatarState, AvatarStateSource } from './types';
export { applyNight } from './night';
export { toExternalStore } from './store';

export function sourceFor(cfg: Pick<AiFaceAppConfig, 'source' | 'activity' | 'expression'>): AvatarStateSource {
  return cfg.source === 'fixed'
    ? createFixedSource({ activity: cfg.activity, expression: cfg.expression })
    : createDemoSource();
}
