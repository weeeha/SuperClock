import { describe, it, expect } from 'vitest';
import {
  AVATAR_ACTIVITIES,
  AVATAR_EXPRESSIONS,
  AVATAR_DESIGNS,
  AVATAR_DESIGN_IDS,
  AVATAR_PAGE,
  DEFAULT_DESIGN_ID,
  findDesign,
} from './ai-face-designs';

describe('ai-face design registry', () => {
  it('holds the canonical 12 activities and 7 expressions in spec order', () => {
    expect(AVATAR_ACTIVITIES).toEqual([
      'idle', 'starting', 'listening', 'thinking', 'researching', 'working',
      'answering', 'waiting', 'needs-input', 'complete', 'error', 'sleeping',
    ]);
    expect(AVATAR_EXPRESSIONS).toEqual([
      'neutral', 'happy', 'curious', 'surprised', 'confused', 'concerned', 'playful',
    ]);
  });

  it('registers the 25 abstract-engine designs of SP1', () => {
    expect(AVATAR_DESIGNS).toHaveLength(25);
    const inFamily = (f: string) => AVATAR_DESIGNS.filter((d) => d.family === f);
    expect(inFamily('core-eyes')).toHaveLength(16);
    expect(inFamily('luminous-faces')).toHaveLength(7);
    expect(inFamily('assistant-iris')).toHaveLength(1);
    expect(inFamily('fractal-presence')).toHaveLength(1);
  });

  it('namespaces ids as <family>/<character> and keeps them unique', () => {
    for (const d of AVATAR_DESIGNS) expect(d.id).toBe(`${d.family}/${d.character}`);
    expect(new Set(AVATAR_DESIGN_IDS).size).toBe(AVATAR_DESIGNS.length);
    expect(AVATAR_DESIGN_IDS).toEqual(AVATAR_DESIGNS.map((d) => d.id));
  });

  it('has a page for every family and a default that exists', () => {
    for (const d of AVATAR_DESIGNS) expect(AVATAR_PAGE[d.family]).toMatch(/^\/avatars\/characters\/.+\/index\.html$/);
    expect(findDesign(DEFAULT_DESIGN_ID)?.name).toBe('Wheatley');
    expect(findDesign('nope/nothing')).toBeUndefined();
  });

  it('carries no voice in SP1', () => {
    expect(AVATAR_DESIGNS.some((d) => d.voice)).toBe(false);
  });
});
