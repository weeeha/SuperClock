import { describe, it, expect, vi } from 'vitest';
import { AVATAR_ACTIVITIES, AVATAR_DESIGNS, AVATAR_EXPRESSIONS, findDesign } from '../../../shared/ai-face-designs';
import { abstractAdapter } from './abstract';
import { adapterFor } from './index';

function fakeWindow(character = 'wheatley') {
  const api = {
    state: { character, state: 'idle', emotion: 'neutral', paused: false, reducedMotion: false, frame: 7 },
    getState() { return { ...this.state }; },
    setState: vi.fn(),
    setEmotion: vi.fn(),
    setPaused: vi.fn(),
  };
  return { win: { abstractPreview: api } as unknown as Window, api };
}

const wheatley = findDesign('core-eyes/wheatley')!;

describe('adapter coverage', () => {
  it('every registered design has an adapter that maps all 12 activities and 7 expressions', () => {
    for (const d of AVATAR_DESIGNS) {
      const a = adapterFor(d);
      for (const act of AVATAR_ACTIVITIES) expect(a.activityMap[act], `${d.id} ${act}`).toBeTruthy();
      for (const exp of AVATAR_EXPRESSIONS) expect(a.expressionMap[exp], `${d.id} ${exp}`).toBeTruthy();
    }
  });
});

describe('abstract adapter', () => {
  it('builds the page URL with the character parameter', () => {
    expect(abstractAdapter.pageUrl(wheatley)).toBe('/avatars/characters/core-eyes/index.html?character=wheatley');
  });

  it('returns null until the page API exists', () => {
    expect(abstractAdapter.attach({} as Window, wheatley)).toBeNull();
  });

  it('returns null when the page shows a different character than asked', () => {
    expect(abstractAdapter.attach(fakeWindow('space').win, wheatley)).toBeNull();
  });

  it('applies activity and expression, and only what changed', () => {
    const { win, api } = fakeWindow();
    const c = abstractAdapter.attach(win, wheatley)!;
    c.apply({ activity: 'thinking', expression: 'curious' });
    expect(api.setState).toHaveBeenLastCalledWith('thinking');
    expect(api.setEmotion).toHaveBeenLastCalledWith('curious');
    c.apply({ activity: 'thinking', expression: 'happy' });
    expect(api.setState).toHaveBeenCalledTimes(1);
    expect(api.setEmotion).toHaveBeenLastCalledWith('happy');
  });

  it('samples the frame counter and reports paused or reduced motion as idle', () => {
    const { win, api } = fakeWindow();
    const c = abstractAdapter.attach(win, wheatley)!;
    expect(c.sample()).toEqual({ frame: 7, idle: false });
    api.state.reducedMotion = true;
    expect(c.sample().idle).toBe(true);
  });

  it('pauses through the page API and pauses on destroy', () => {
    const { win, api } = fakeWindow();
    const c = abstractAdapter.attach(win, wheatley)!;
    c.setPaused(true);
    expect(api.setPaused).toHaveBeenLastCalledWith(true);
    api.setPaused.mockClear();
    c.destroy();
    expect(api.setPaused).toHaveBeenCalledWith(true);
  });

  it('hides the gallery chrome and fills the square in its kiosk stylesheet', () => {
    expect(abstractAdapter.kioskCss).toContain('.page-nav');
    expect(abstractAdapter.kioskCss).toContain('.abstract-controls');
    expect(abstractAdapter.kioskCss).toContain('100vmin');
  });
});
