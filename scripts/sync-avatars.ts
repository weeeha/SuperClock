// npm run sync:avatars -- <path to a clean AI-Avatars checkout>
// Copies the allowlisted files into public/avatars/ and records the source SHA.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWLIST, WATCHED_DIRS, planSync } from './lib/avatar-sync';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src || !existsSync(join(src, 'catalog.json'))) {
  console.error('usage: npm run sync:avatars -- <path to an AI-Avatars checkout>');
  process.exit(1);
}
const git = (...args: string[]) => execFileSync('git', ['-C', src, ...args], { encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) {
  console.error('AI-Avatars checkout has local changes; sync only from a committed SHA.');
  process.exit(1);
}
const sha = git('rev-parse', 'HEAD');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [relative(src, full)];
  });
const watched = [
  ...WATCHED_DIRS.flatMap((d) => (existsSync(join(src, d)) ? walk(join(src, d)) : [])),
  ...ALLOWLIST.filter((f) => !WATCHED_DIRS.some((d) => f.startsWith(`${d}/`)) && existsSync(join(src, f))),
];
const plan = planSync(watched, ALLOWLIST);
if (plan.unknown.length || plan.missing.length) {
  if (plan.unknown.length) console.error('Not on the allowlist (scripts/lib/avatar-sync.ts):\n  ' + plan.unknown.join('\n  '));
  if (plan.missing.length) console.error('Allowlisted but missing upstream:\n  ' + plan.missing.join('\n  '));
  process.exit(1);
}

const out = join(root, 'public', 'avatars');
rmSync(out, { recursive: true, force: true });
for (const f of plan.copy) {
  mkdirSync(dirname(join(out, f)), { recursive: true });
  cpSync(join(src, f), join(out, f));
}
writeFileSync(join(out, 'VERSION'), `${sha}\n${new Date().toISOString().slice(0, 10)}\n`);
console.log(`synced ${plan.copy.length} files from AI-Avatars ${sha.slice(0, 7)}`);
