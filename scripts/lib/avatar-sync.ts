// What SuperClock vendors from weeeha/AI-Avatars, derived from the design
// registry so a new design cannot ship without its files (and vice versa).
// Anything else that appears upstream in a watched directory fails the sync:
// a new asset is a conscious decision, not a silent payload increase.
import { AVATAR_DESIGNS } from '../../src/shared/ai-face-designs';

const families = [...new Set(AVATAR_DESIGNS.map((d) => d.family))];

export const ALLOWLIST: string[] = [
  'assets/preview.css',
  'assets/preview-state.js',
  'assets/abstract-performance.css',
  'assets/abstract-performance.js',
  ...families.flatMap((f) => [`characters/${f}/index.html`, `characters/${f}/index.css`, `characters/${f}/index.js`]),
  ...AVATAR_DESIGNS.map((d) => `assets/abstract/${d.character}.png`),
];

export const WATCHED_DIRS: string[] = [...families.map((f) => `characters/${f}`), 'assets/abstract'];

const IGNORED = [/\.gif$/, /(^|\/)README\.md$/, /\/(sources|concepts|frames|animation-sources)\//];

export function planSync(watchedFiles: string[], allowlist: string[]) {
  const present = new Set(watchedFiles);
  const allowed = new Set(allowlist);
  return {
    copy: allowlist.filter((f) => present.has(f)),
    unknown: watchedFiles.filter((f) => !allowed.has(f) && !IGNORED.some((re) => re.test(f))),
    missing: allowlist.filter((f) => !present.has(f)),
  };
}
