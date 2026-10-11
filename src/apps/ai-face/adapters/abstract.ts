import {
  AVATAR_PAGE,
  type AvatarActivity,
  type AvatarDesign,
  type AvatarExpression,
} from '../../../shared/ai-face-designs';
import type { AvatarState } from '../sources/types';
import type { FamilyAdapter } from './types';

// AI-Avatars' shared abstract engine (assets/abstract-performance.js) behind
// core-eyes, luminous-faces, assistant-iris and fractal-presence. It already
// speaks the canonical vocabulary, so both maps are identities, written out so
// the coverage test can hold them and SP2 families can differ.
interface AbstractApi {
  getState(): { character: string; paused: boolean; reducedMotion: boolean; frame: number };
  setState(activity: string): void;
  setEmotion(emotion: string): void;
  setPaused(paused: boolean): void;
}

const activityMap: Record<AvatarActivity, string> = {
  idle: 'idle', starting: 'starting', listening: 'listening', thinking: 'thinking',
  researching: 'researching', working: 'working', answering: 'answering', waiting: 'waiting',
  'needs-input': 'needs-input', complete: 'complete', error: 'error', sleeping: 'sleeping',
};
const expressionMap: Record<AvatarExpression, string> = {
  neutral: 'neutral', happy: 'happy', curious: 'curious', surprised: 'surprised',
  confused: 'confused', concerned: 'concerned', playful: 'playful',
};

const kioskCss = `
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: black; }
.page { max-width: none !important; margin: 0 !important; padding: 0 !important; }
.page-nav, .abstract-controls { display: none !important; }
.abstract-stage { max-width: none !important; width: 100vmin !important; height: 100vmin !important; margin: 0 !important; }
`;

export const abstractAdapter: FamilyAdapter = {
  pageUrl: (d: AvatarDesign) => `${AVATAR_PAGE[d.family]}?character=${encodeURIComponent(d.character)}`,
  kioskCss,
  activityMap,
  expressionMap,
  attach(win, design) {
    const api = (win as unknown as { abstractPreview?: AbstractApi }).abstractPreview;
    if (!api || api.getState().character !== design.character) return null;
    let last: AvatarState | null = null;
    return {
      apply(s) {
        if (last?.activity !== s.activity) api.setState(activityMap[s.activity]);
        if (last?.expression !== s.expression) api.setEmotion(expressionMap[s.expression]);
        last = s;
      },
      setPaused: (p) => api.setPaused(p),
      setMuted: () => {},
      sample: () => {
        const st = api.getState();
        return { frame: st.frame, idle: st.paused || st.reducedMotion };
      },
      destroy: () => api.setPaused(true),
    };
  },
};
