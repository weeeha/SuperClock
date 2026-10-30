import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// No test runs the vendored shader page, so a re-vendor from Radiant that
// drops a SuperClock change is otherwise caught only on glass. This reads the
// shipped file as text and holds the surface VinylClock drives.
const page = readFileSync(resolve(process.cwd(), 'public/shaders/vinyl-grooves.html'), 'utf8');

describe('vendored vinyl-grooves page contract', () => {
  it('credits Radiant and its MIT licence', () => {
    expect(page).toMatch(/github\.com\/pbakaus\/radiant/);
    expect(page).toMatch(/MIT License/);
  });

  it('assigns window.vinylGrooves with getState, setPaused and setParam', () => {
    expect(page).toMatch(/window\.vinylGrooves\s*=\s*\{[\s\S]*getState[\s\S]*setPaused[\s\S]*setParam[\s\S]*\}/);
  });

  it('returns frame, paused and reducedMotion from getState', () => {
    for (const key of ['frame', 'paused', 'reducedMotion']) {
      expect(page, `getState() should return ${key}`).toMatch(new RegExp(`getState:[^}]*\\b${key}:`));
    }
  });

  it('answers the three params the face and the Radiant gallery set', () => {
    for (const name of ['ROTATION_SPEED', 'GROOVE_DENSITY', 'SPECTRUM']) {
      expect(page).toMatch(new RegExp(`case '${name}':`));
    }
    expect(page).toMatch(/e\.data\.type === 'param'/);
  });

  it('renders the record on a transparent canvas with premultiplied alpha', () => {
    expect(page).toMatch(/premultipliedAlpha: true/);
    expect(page).toMatch(/background: transparent/);
    expect(page).toMatch(/gl_FragColor = vec4\(col \* alpha, alpha\)/);
  });

  it('draws no title label and takes no mouse or touch input (the kiosk owns gestures)', () => {
    expect(page).not.toMatch(/class="label"/);
    expect(page).not.toMatch(/mousedown|touchstart/);
  });

  it('stops its loop while paused or hidden instead of drawing into a hidden document', () => {
    expect(page).toMatch(/if \(paused \|\| document\.hidden\) return;/);
    expect(page).toMatch(/visibilitychange/);
  });
});
