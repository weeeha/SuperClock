// Schema liveness — the ledger and the predicate, as a module so both the gate
// (schema-liveness.test.ts) and the health report (scripts/lib/health-report.ts)
// read one implementation. Node-only: nothing in either SPA imports this.
//
// A schema is "consumed" when the component that owns it VALUE-imports the
// schema module (the Calendar pattern, `schema.safeParse(config ?? {})`).
// `import type` is erased at build time and does not count. Owners by kind:
// app.<id> → anything under src/apps/<id>/, face.<id> → its component per
// face-components.ts, complication.<id> → its renderer in
// src/shared/complications/.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Schemas the admin renders a form for that nothing on the glass reads yet.
 *  One reason each. May only SHRINK: wire the component to the Calendar
 *  pattern, then delete its line here. Frozen 2026-09-05 at 14 of 27 and paid
 *  down to zero the same day; empty is the intended steady state. */
export const SCHEMA_UNREAD: Record<string, string> = {};

/** Every schema kind must have an owner mapping in consumerOf(). */
export const SCHEMA_KINDS = ['app.', 'face.', 'complication.'] as const;

export function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourcesUnder(full));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function kebabToPascal(id: string): string {
  return id
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

/** A statement-level value import whose specifier ENDS with `modulePath`
 *  (any relative prefix). Mixed imports (`{ schema, type Config }`) count;
 *  `import type …` does not. */
export function valueImportsModule(source: string, modulePath: string): boolean {
  const re = new RegExp(
    `^\\s*import\\s+(?!type\\s)[^;]*?from\\s+['"][^'"]*${escapeRe(modulePath)}['"]`,
    'm',
  );
  return re.test(source);
}

/** face id → component file, parsed from face-components.ts (never
 *  hand-listed — the token gate reconciles faces from the same file). */
export function faceComponentFiles(source: string): Record<string, string> {
  const nameToFile = new Map<string, string>();
  for (const m of source.matchAll(/^import\s+(\w+)\s+from\s+'\.\/(\w+)';?$/gm)) {
    nameToFile.set(m[1], m[2]);
  }
  const start = source.indexOf('FACE_COMPONENTS');
  const block = source.slice(start, source.indexOf('};', start));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/^\s*'?([\w-]+)'?:\s*(\w+),?\s*$/gm)) {
    const file = nameToFile.get(m[2]);
    if (file) out[m[1]] = `src/apps/clock/${file}.tsx`;
  }
  return out;
}

let faceFilesCache: Record<string, string> | null = null;
export function faceFiles(): Record<string, string> {
  faceFilesCache ??= faceComponentFiles(readFileSync('src/apps/clock/face-components.ts', 'utf8'));
  return faceFilesCache;
}

/** Where a schema's consumer must live, and the module it must import. */
export function consumerOf(id: string): { where: string; files: string[]; module: string } {
  const module = `schemas/${id}`;
  if (id.startsWith('app.')) {
    const dir = `src/apps/${id.slice('app.'.length)}`;
    return { where: `${dir}/**`, files: sourcesUnder(dir), module };
  }
  if (id.startsWith('face.')) {
    const file = faceFiles()[id.slice('face.'.length)];
    if (!file) throw new Error(`no face component maps to schema '${id}' in face-components.ts`);
    return { where: file, files: [file], module };
  }
  if (id.startsWith('complication.')) {
    const file = `src/shared/complications/${kebabToPascal(id.slice('complication.'.length))}.tsx`;
    if (!existsSync(file)) throw new Error(`no renderer ${file} for schema '${id}'`);
    return { where: file, files: [file], module };
  }
  throw new Error(`unclassified schema kind: '${id}' — add its owner mapping to consumerOf()`);
}

export function isConsumed(id: string): boolean {
  const { files, module } = consumerOf(id);
  return files.some((f) => valueImportsModule(readFileSync(f, 'utf8'), module));
}
