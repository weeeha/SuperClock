// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isClaimedTarget } from './gesture-zones';

describe('isClaimedTarget', () => {
  it('is true inside an element that claims the gesture, including SVG', () => {
    document.body.innerHTML = `
      <div data-gesture="claim"><span id="inner"></span></div>
      <svg><circle id="band" data-gesture="claim"></circle></svg>
      <p id="free"></p>`;
    expect(isClaimedTarget(document.getElementById('inner'))).toBe(true);
    expect(isClaimedTarget(document.getElementById('band'))).toBe(true);
    expect(isClaimedTarget(document.getElementById('free'))).toBe(false);
    expect(isClaimedTarget(null)).toBe(false);
  });
});
