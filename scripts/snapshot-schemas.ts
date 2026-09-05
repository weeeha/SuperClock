// Refresh src/shared/schemas.snapshot.json from the live zod schemas:
//   npm run snapshot:schemas
//
// The committed snapshot is what schema-snapshot.test.ts pins CI to. This
// runner classifies the diff (breaking / minor / patch) and REFUSES to write a
// breaking change until FLEET_SCHEMA_VERSION has moved, so the migration that
// rewrites stored configs ships in the same PR as the schema change. All
// judgment lives in src/shared/schema-snapshot.ts (pure, unit-tested); this
// file only reads, prints, writes and exits.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; // never URL.pathname: this checkout path contains spaces
import { chdir, exit } from 'node:process';
import {
  buildSchemaSnapshot,
  formatSchemaChanges,
  serializeSnapshot,
  snapshotRefreshVerdict,
  SNAPSHOT_PATH,
  type SchemaSnapshot,
} from '../src/shared/schema-snapshot';

chdir(fileURLToPath(new URL('..', import.meta.url)));

const live = buildSchemaSnapshot();
const committed: SchemaSnapshot | null = existsSync(SNAPSHOT_PATH)
  ? (JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as SchemaSnapshot)
  : null;
const verdict = snapshotRefreshVerdict(committed, live);
const count = Object.keys(live.schemas).length;

switch (verdict.action) {
  case 'create':
    writeFileSync(SNAPSHOT_PATH, serializeSnapshot(live));
    console.log(
      `snapshot:schemas: wrote ${SNAPSHOT_PATH} (${count} schemas, fleet schema v${live.fleetSchemaVersion}).`,
    );
    break;
  case 'current':
    console.log(`snapshot:schemas: ${SNAPSHOT_PATH} already matches the live schemas (${count} schemas).`);
    break;
  case 'refuse':
    console.error(formatSchemaChanges(verdict.changes));
    console.error(`snapshot:schemas: REFUSED. ${verdict.reason}`);
    exit(1);
    break;
  case 'update':
    writeFileSync(SNAPSHOT_PATH, serializeSnapshot(live));
    console.log(
      verdict.changes.length
        ? formatSchemaChanges(verdict.changes)
        : '  (formatting or fleet schema version only, no schema change)',
    );
    console.log(`snapshot:schemas: updated ${SNAPSHOT_PATH}.`);
    break;
}
