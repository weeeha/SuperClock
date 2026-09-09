// Rewrites src/apps/claude-usage/sprites.ts in place, replacing each frame's
// `cells` integer array with an `rle` string. Refuses to write unless every
// emitted string decodes back to the exact array it came from.
//
// The SPRITES object literal sits entirely on one line of that file, which is
// what makes this a line-level rewrite rather than a parse of the module.
//
// This repo has no sprite generator — the table was scraped upstream by the
// mac-daemon — so this script is the path any future regeneration takes.
// Keep the two functions below in sync with src/apps/claude-usage/sprite-codec.ts;
// they are duplicated rather than imported because this is plain node with no
// TypeScript loader, and the round-trip assertion below is what keeps the two
// honest.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// URL.pathname would break: this checkout's path contains a space.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'src/apps/claude-usage/sprites.ts');
const A = 'a'.charCodeAt(0);

function encodeCells(cells) {
  let out = '';
  let run = 1;
  for (let i = 1; i <= cells.length; i++) {
    if (i < cells.length && cells[i] === cells[i - 1]) {
      run++;
      continue;
    }
    out += String.fromCharCode(A + cells[i - 1]) + (run > 1 ? String(run) : '');
    run = 1;
  }
  return out;
}

function decodeCells(rle) {
  const cells = [];
  let consumed = 0;
  for (const m of rle.matchAll(/([a-z])(\d*)/g)) {
    if (m.index !== consumed) break;
    consumed = m.index + m[0].length;
    const value = m[1].charCodeAt(0) - A;
    const count = m[2] === '' ? 1 : Number(m[2]);
    for (let i = 0; i < count; i++) cells.push(value);
  }
  if (consumed !== rle.length) throw new Error(`malformed RLE at ${consumed}`);
  return cells;
}

const lines = readFileSync(target, 'utf8').split('\n');
const idx = lines.findIndex((l) => l.startsWith('export const SPRITES'));
if (idx === -1) throw new Error('SPRITES declaration not found');

const line = lines[idx];
const sprites = JSON.parse(line.slice(line.indexOf('{')).replace(/;\s*$/, ''));

let frames = 0;
let cellCount = 0;
for (const [id, sprite] of Object.entries(sprites)) {
  if (sprite.palette.length > 26) {
    throw new Error(`${id} has a ${sprite.palette.length}-colour palette; the format holds 26`);
  }
  for (const frame of sprite.frames) {
    const original = frame.cells;
    const rle = encodeCells(original);
    const back = decodeCells(rle);
    if (back.length !== original.length || back.some((v, i) => v !== original[i])) {
      throw new Error(`round trip failed for ${id} frame ${frames}: refusing to write`);
    }
    cellCount += original.length;
    delete frame.cells;
    frame.rle = rle;
    frames++;
  }
}

const before = readFileSync(target, 'utf8').length;
lines[idx] = `export const SPRITES: Record<string, Sprite> = ${JSON.stringify(sprites)};`;
const out = lines.join('\n');
writeFileSync(target, out, 'utf8');

console.log(
  `encoded ${Object.keys(sprites).length} sprites, ${frames} frames, ${cellCount} cells verified`,
);
console.log(`sprites.ts ${before} -> ${out.length} bytes`);
