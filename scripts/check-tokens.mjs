// Token gate — enforces the two token contracts this repo has decided:
//
//   1. Semantic-only zones (src/admin, src/core): styling reaches CSS through
//      tokens (admin: shadcn semantics under .admin-root; kiosk core: the
//      @theme block in src/index.css). No raw hex, no raw color functions,
//      no Tailwind palette classes, no muted-on-muted contrast pairing.
//   2. Faces (reconciled from face-components.ts's real imports, never a
//      hand-kept list): every face consumes --face-* so the night palette
//      flip reaches it. Legacy exceptions live in FACE_TOKEN_EXEMPT in
//      lib/token-rules.mjs and may only shrink.
//
// src/apps/** outside the face rule and src/shared/** are deliberately NOT
// gated: app art directions and schema default values are data, not styling
// under contract. Escape hatch for data-not-styling lines inside gated zones:
// a `token-gate:allow <reason>` comment on the same line.
//
// All judgment lives in lib/token-rules.mjs (pure, unit-tested); this file
// only globs, reads, and exits.

import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { chdir } from 'node:process';

import {
  findSemanticZoneViolations,
  findSingleStringViolations,
  findCvaViolations,
  parseFaceComponentFiles,
  findFaceTokenGap,
  FACE_TOKEN_EXEMPT,
} from './lib/token-rules.mjs';
import { UNCONSUMED_LEDGER } from './lib/token-liveness.mjs';
import { uncheckedRules, formatUnchecked } from './lib/rules.mjs';

chdir(fileURLToPath(new URL('..', import.meta.url)));

const violations = [];

// Zone 1 — semantic-only sources.
const semanticFiles = globSync('src/{admin,core}/**/*.{ts,tsx}', {
  exclude: (f) => f.includes('.test.'),
});
if (semanticFiles.length === 0) {
  console.warn('check:tokens — WARNING: no files under src/{admin,core}. Gate has no coverage.');
}
for (const file of semanticFiles) {
  const source = readFileSync(file, 'utf8');
  violations.push(
    ...findSemanticZoneViolations(file, source),
    ...findSingleStringViolations(file, source),
    ...findCvaViolations(file, source),
  );
}

// Zone 2 — faces, from real imports.
const faceIndex = 'src/apps/clock/face-components.ts';
const faceNames = parseFaceComponentFiles(readFileSync(faceIndex, 'utf8'));
if (faceNames.length === 0) {
  console.warn(`check:tokens — WARNING: no face imports parsed from ${faceIndex}.`);
}
for (const name of faceNames) {
  const file = `src/apps/clock/${name}.tsx`;
  const gap = findFaceTokenGap(file, readFileSync(file, 'utf8'));
  if (gap) violations.push(gap);
}

// Every run ends by naming what it did not inspect: the tokens declared on
// purpose but read by nothing (liveness itself is gated in npm test by
// src/shared/token-liveness.test.ts), and the rules that have no detector at
// all (scripts/lib/rules.mjs). Printed on failure too, so a red gate never
// hides the list.
function printUninspected() {
  const unchecked = uncheckedRules();
  console.log(
    `check:tokens — ${UNCONSUMED_LEDGER.length} token(s) ledgered as declared-but-unread (UNCONSUMED_LEDGER, shrink-only; liveness gated by src/shared/token-liveness.test.ts).`,
  );
  console.log(`check:tokens — ${unchecked.length} rule(s) have no detector (scripts/lib/rules.mjs):`);
  console.log(formatUnchecked(unchecked));
}

if (violations.length) {
  for (const v of violations) console.error(v);
  console.error(
    `\ncheck:tokens — ${violations.length} violation(s). Use the project tokens (admin: .admin-root semantics; kiosk: src/index.css @theme; faces: --face-*).`,
  );
  printUninspected();
  process.exit(1);
}

console.log(
  `check:tokens — ${semanticFiles.length} semantic-zone file(s) and ${faceNames.length} face(s) clean (${FACE_TOKEN_EXEMPT.length} legacy face(s) exempt — list may only shrink).`,
);
printUninspected();
