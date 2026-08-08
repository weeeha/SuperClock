import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface BuildInfo {
  commit: string;
  branch: string;
  builtAt: string;
}

// Reads the stamp scripts/write-build-info.mjs drops next to the bundle at
// build time. The lookup is relative to THIS module, not cwd: bundled, that
// resolves to dist/server.mjs → dist/build-info.json; running from source
// (tsx server.ts) no stamp exists next to server/ and health honestly
// reports build: null — a dev process has no build identity to claim.
export function readBuildInfo(
  dir: string = dirname(fileURLToPath(import.meta.url)),
): BuildInfo | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, 'build-info.json'), 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { commit, branch, builtAt } = parsed as Partial<BuildInfo>;
    if (typeof commit !== 'string' || commit.length === 0) return null;
    return {
      commit,
      branch: typeof branch === 'string' ? branch : '',
      builtAt: typeof builtAt === 'string' ? builtAt : '',
    };
  } catch {
    return null;
  }
}

// The stamp can only change when the bundle file is replaced, and a replaced
// bundle means a restarted process — so one read per process is exact.
let cached: BuildInfo | null | undefined;
export function getBuildInfo(): BuildInfo | null {
  if (cached === undefined) cached = readBuildInfo();
  return cached;
}
