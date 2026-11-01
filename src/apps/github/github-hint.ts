/** The line under "GitHub not connected": what to do, from the proxy's own
 *  error string. The 503 for a missing token names GITHUB_TOKEN; a token
 *  GitHub rejects comes back as "GitHub API HTTP 401" (or 403), possibly
 *  marked stale; anything else is the server or GitHub being away. */
export function githubHint(error: string): string {
  if (error.includes('GITHUB_TOKEN')) return 'add a GitHub token on this clock';
  if (/HTTP (401|403)\b/.test(error)) return 'the GitHub token on this clock was rejected';
  return 'server unreachable';
}
