// Which files in public/ are reachable from code.
//
// public/ ships verbatim into dist/ and then to every Pi, so an asset no
// code path can reach is payload on four devices forever. Deleting the nine
// orphans found on 2026-09-06 does not stop the class; this does.
//
// fs-free by design, like token-liveness.mjs beside it: the real-tree gate
// in src/shared/asset-liveness.test.ts does the walking and hands the
// results here.

// Directories whose asset paths are BUILT AT RUNTIME from an id, so no
// literal path for them exists anywhere in src/. Each entry names the file
// that builds the path — that file is the reason this directory cannot be
// checked the ordinary way.
export const COMPUTED_ASSET_DIRS = {
  'agents/': 'src/apps/agents/provider.ts builds `/agents/${id}.png` from the agent id',
  'fitness/':
    'src/apps/fitness/ExerciseArt.tsx and audio.ts build `/fitness/${id}.png` and `/fitness/voice/${id}.m4a` from the exercise id',
};

// Files that ship for a reason other than being named by code.
// Shrink-only, same idiom as UNCONSUMED_LEDGER: an entry that gains a real
// reference, or names a file that no longer exists, fails as stale.
export const ASSET_EXEMPT = {
  'photos/.gitkeep': 'holds the gitignored public/photos/ directory in the tree',
};

export function isComputed(rel) {
  return Object.keys(COMPUTED_ASSET_DIRS).some((dir) => rel.startsWith(dir));
}

// Returns the public-relative paths that nothing references. `corpus` is
// every candidate source file concatenated; a reference is the path with its
// leading slash, which is how every consumer in this repo writes one.
export function auditAssets(relPaths, corpus) {
  const orphans = [];
  for (const rel of relPaths) {
    if (isComputed(rel)) continue;
    if (Object.hasOwn(ASSET_EXEMPT, rel)) continue;
    if (corpus.includes(`/${rel}`)) continue;
    orphans.push(rel);
  }
  return orphans;
}
