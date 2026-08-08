#!/usr/bin/env node
// Stamps dist/build-info.json as the last step of `npm run build` so the
// server can answer "what commit am I?" (/api/health `build` field) and
// deploy.sh can verify a deploy actually took (post-deploy SHA compare).
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const git = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

const info = {
  commit: git('git rev-parse HEAD'),
  branch: git('git rev-parse --abbrev-ref HEAD'),
  builtAt: new Date().toISOString(),
};

writeFileSync('dist/build-info.json', JSON.stringify(info) + '\n');
console.log(`build-info: ${info.commit.slice(0, 7)} (${info.branch}) @ ${info.builtAt}`);
