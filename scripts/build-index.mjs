// Emit index/parts.toon from every part meta. Run after editing a meta;
// src/shared/parts-index.test.ts fails until the committed file matches.
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { chdir } from 'node:process';
import { collectMetaPaths, emitIndex, partRow } from './lib/parts-index.mjs';

chdir(fileURLToPath(new URL('..', import.meta.url)));

const rows = collectMetaPaths(globSync).map((path) => partRow(JSON.parse(readFileSync(path, 'utf8')), path));
mkdirSync('index', { recursive: true });
writeFileSync('index/parts.toon', emitIndex(rows));
console.log(`build:index — ${rows.length} part(s) written to index/parts.toon`);
