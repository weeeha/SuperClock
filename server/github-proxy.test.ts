// The pure halves of the GitHub proxy: login validation and the GraphQL query
// builder. A username from the admin form reaches the GitHub API only through
// these two, so an invalid login is refused here rather than interpolated.

import { describe, it, expect } from 'vitest';
import { isValidLogin, buildContributionsQuery } from './github-proxy';

describe('isValidLogin', () => {
  it('accepts GitHub logins (alphanumerics and single hyphens, up to 39 chars)', () => {
    expect(isValidLogin('weeeha')).toBe(true);
    expect(isValidLogin('a-b-c')).toBe(true);
    expect(isValidLogin('x'.repeat(39))).toBe(true);
  });
  it('rejects anything that could break out of the query', () => {
    for (const bad of ['', 'a b', 'a"b', 'a\\b', '-lead', 'trail-', 'a--b', 'x'.repeat(40), 'a{b}']) {
      expect(isValidLogin(bad), bad).toBe(false);
    }
  });
});

describe('buildContributionsQuery', () => {
  it('without a login queries the token owner (viewer), the historical shape', () => {
    const q = buildContributionsQuery(null);
    expect(q).toContain('viewer {');
    expect(q).not.toContain('user(');
    expect(q).toContain('contributionCalendar');
  });
  it('with a login queries that user and still returns the same fields', () => {
    const q = buildContributionsQuery('weeeha');
    expect(q).toContain('user(login: "weeeha") {');
    expect(q).not.toContain('viewer {');
    expect(q).toContain('login');
    expect(q).toContain('contributionCalendar');
  });
});
