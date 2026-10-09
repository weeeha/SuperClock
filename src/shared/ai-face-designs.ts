// The AI Face design registry: which AI-Avatars characters SuperClock ships,
// and the one state vocabulary every family adapter maps onto. Data only, so
// the app, the app.ai-face schema and scripts/sync-avatars.ts share it.
// Spec: docs/superpowers/specs/2026-10-09-ai-face-design.md

export const AVATAR_ACTIVITIES = [
  'idle', 'starting', 'listening', 'thinking', 'researching', 'working',
  'answering', 'waiting', 'needs-input', 'complete', 'error', 'sleeping',
] as const;
export type AvatarActivity = (typeof AVATAR_ACTIVITIES)[number];

export const AVATAR_EXPRESSIONS = [
  'neutral', 'happy', 'curious', 'surprised', 'confused', 'concerned', 'playful',
] as const;
export type AvatarExpression = (typeof AVATAR_EXPRESSIONS)[number];

export type AvatarFamily = 'core-eyes' | 'luminous-faces' | 'assistant-iris' | 'fractal-presence';
export type AvatarRenderer = 'canvas2d' | 'webgl' | 'video' | 'dom';

export interface AvatarDesign {
  id: string;
  family: AvatarFamily;
  character: string;
  name: string;
  renderer: AvatarRenderer;
  voice: boolean;
}

export const AVATAR_PAGE: Record<AvatarFamily, string> = {
  'core-eyes': '/avatars/characters/core-eyes/index.html',
  'luminous-faces': '/avatars/characters/luminous-faces/index.html',
  'assistant-iris': '/avatars/characters/assistant-iris/index.html',
  'fractal-presence': '/avatars/characters/fractal-presence/index.html',
};

const design = (family: AvatarFamily, character: string, name: string, renderer: AvatarRenderer): AvatarDesign => ({
  id: `${family}/${character}`, family, character, name, renderer, voice: false,
});

const CORE_EYES: [string, string][] = [
  ['wheatley', 'Wheatley'], ['space', 'Space'], ['rick', 'Rick'], ['fact', 'Fact'],
  ['morality', 'Morality'], ['curiosity', 'Curiosity'], ['intelligence', 'Intelligence'], ['anger', 'Anger'],
  ['paranoia', 'Paranoia'], ['optimism', 'Optimism'], ['nihilism', 'Nihilism'], ['priority', 'Priority'],
  ['orbit', 'Orbit'], ['signal', 'Signal'], ['gear', 'Gear'], ['aperture', 'Aperture'],
];
const LUMINOUS: [string, string][] = [
  ['constellation', 'Constellation'], ['halo', 'Halo'], ['prism', 'Prism'], ['knot', 'Knot'],
  ['portal', 'Portal'], ['sun', 'Sun'], ['pulse', 'Pulse'],
];

export const AVATAR_DESIGNS: readonly AvatarDesign[] = [
  ...CORE_EYES.map(([c, n]) => design('core-eyes', c, n, 'canvas2d')),
  ...LUMINOUS.map(([c, n]) => design('luminous-faces', c, n, 'canvas2d')),
  design('assistant-iris', 'assistant-iris', 'Assistant iris', 'webgl'),
  design('fractal-presence', 'fractal-presence', 'Fractal presence', 'webgl'),
];

export const AVATAR_DESIGN_IDS = AVATAR_DESIGNS.map((d) => d.id) as [string, ...string[]];
export const DEFAULT_DESIGN_ID = 'core-eyes/wheatley';

export function findDesign(id: string): AvatarDesign | undefined {
  return AVATAR_DESIGNS.find((d) => d.id === id);
}
