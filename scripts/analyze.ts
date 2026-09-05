// Declared vs read: which config fields, --face-* tokens and slots each app and
// face actually consumes, from source text.
//   npm run analyze              print the report
//   npm run analyze -- --write   refresh docs/analysis/declared-vs-read.md
//
// The committed report is pinned by scripts/lib/analyze.test.ts, so `npm test`
// fails while it is stale. All judgment lives in src/shared/declared-vs-read.ts
// (pure, unit-tested); the tree walk is scripts/lib/analyze-sources.ts.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url'; // never URL.pathname: this checkout path contains spaces
import { argv, chdir, stdout } from 'node:process';
import { analyzeDeclaredVsRead, renderDeclaredVsRead } from '../src/shared/declared-vs-read';
import { collectAnalyzeInput, REPORT_PATH } from './lib/analyze-sources';

chdir(fileURLToPath(new URL('..', import.meta.url)));

const report = renderDeclaredVsRead(analyzeDeclaredVsRead(collectAnalyzeInput()));

if (argv.includes('--write')) {
  const before = existsSync(REPORT_PATH) ? readFileSync(REPORT_PATH, 'utf8') : null;
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, report);
  console.log(
    before === report ? `analyze: ${REPORT_PATH} already current.` : `analyze: wrote ${REPORT_PATH}.`,
  );
} else {
  stdout.write(report);
}
