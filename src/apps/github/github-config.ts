// Pure mapping from the app.github schema to what the app needs. The defaults
// reproduce the pre-schema behaviour: GitHub's own green ramp, the token
// owner's calendar (viewer), and the historical cache key.

import type { GithubAppConfig } from '../../shared/schemas/app.github';

export type ColorScheme = GithubAppConfig['colorScheme'];

/** Five heatmap steps: 0 = no contributions, 4 = the year's max. */
export type Palette = readonly [string, string, string, string, string];

/** GitHub's contribution-graph greens, the historical and default palette. */
export const GITHUB_GREENS: Palette = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

/** GitHub's dark-theme grey ramp; the empty cell stays the same. */
const GREYS: Palette = ['#161b22', '#30363d', '#6e7681', '#b1bac4', '#f0f6fc'];

/** Ramps into the configured kiosk accent. SVG `fill` accepts CSS colour
 *  functions in Chromium, so the steps are color-mix() over the accent token
 *  and follow the admin's accent setting live. */
const ACCENT: Palette = [
  '#161b22',
  'color-mix(in srgb, var(--color-accent) 35%, #161b22)',
  'color-mix(in srgb, var(--color-accent) 60%, #161b22)',
  'color-mix(in srgb, var(--color-accent) 85%, #161b22)',
  'var(--color-accent)',
];

export function paletteFor(scheme: ColorScheme): Palette {
  switch (scheme) {
    case 'monochrome':
      return GREYS;
    case 'accent':
      return ACCENT;
    default:
      return GITHUB_GREENS;
  }
}

const HISTORICAL_KEY = 'superclock:github:contrib';

/** localStorage key for a user's last-good graph. Blank keeps the historical
 *  key so an existing cache still seeds the boot paint after this change. */
export function cacheKeyFor(username: string): string {
  const u = username.trim().toLowerCase();
  return u ? `${HISTORICAL_KEY}:${u}` : HISTORICAL_KEY;
}

/** Proxy URL; blank asks for the token owner (viewer). */
export function contributionsUrl(username: string): string {
  const u = username.trim();
  return u ? `/api/github/contributions?username=${encodeURIComponent(u)}` : '/api/github/contributions';
}
