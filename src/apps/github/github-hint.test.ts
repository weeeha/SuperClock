// The not-connected tell names what to do. A dead token used to read as
// "server unreachable" (2026-10-23 on glass, 2026-11-01 review): only the
// "not configured" string mapped to a hint.
import { describe, it, expect } from 'vitest';
import { githubHint } from './github-hint';

describe('githubHint', () => {
  it('no token on the server: add one', () => {
    expect(githubHint('GITHUB_TOKEN not configured on the server')).toBe('add a GitHub token on this clock');
  });

  it('a token GitHub rejects: say so, not "unreachable"', () => {
    expect(githubHint('proxy: GitHub API HTTP 401')).toBe('the GitHub token on this clock was rejected');
    expect(githubHint('proxy: GitHub API HTTP 401 (stale)')).toBe('the GitHub token on this clock was rejected');
    expect(githubHint('proxy: GitHub API HTTP 403')).toBe('the GitHub token on this clock was rejected');
  });

  it('anything else is the server or GitHub being away', () => {
    expect(githubHint('proxy: fetch failed')).toBe('server unreachable');
    expect(githubHint('')).toBe('server unreachable');
  });
});
