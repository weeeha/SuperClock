import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALLOWLIST } from '../../../scripts/lib/avatar-sync';

// No test runs the vendored engine, so a re-sync that renames the page API is
// otherwise caught only in a browser. This reads the shipped file as text and
// holds the surface the abstract adapter drives.
const AVATARS = resolve(process.cwd(), 'public/avatars');
const engine = readFileSync(resolve(AVATARS, 'assets/abstract-performance.js'), 'utf8');

describe('vendored abstract engine contract', () => {
  it('assigns window.abstractPreview', () => {
    expect(engine).toMatch(/window\.abstractPreview\s*=\s*api\b/);
  });

  it('exposes getState, setState, setEmotion and setPaused on the api object', () => {
    expect(engine).toMatch(/const api=\{getState:[\s\S]*?\}\),setState,setEmotion,setPaused[,}]/);
  });

  it('returns character, paused, reducedMotion and frame from getState', () => {
    const body = engine.match(/const api=\{getState:\(\)=>\(\{([\s\S]*?)\}\),setState,setEmotion,setPaused/)?.[1] ?? '';
    for (const key of ['character', 'paused', 'reducedMotion', 'frame']) {
      expect(body, `getState() should return ${key}`).toMatch(new RegExp(`(^|,)${key}(:|,|$)`));
    }
  });
});

describe('vendored files', () => {
  it('has every file the sync allowlist names under public/avatars', () => {
    const missing = ALLOWLIST.filter((f) => !existsSync(resolve(AVATARS, f)));
    expect(missing).toEqual([]);
  });
});
