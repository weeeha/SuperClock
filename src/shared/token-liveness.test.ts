// Token liveness gate: every token declared in src/index.css (kiosk) and
// src/admin/index.css (admin) is read somewhere in src/, or sits in
// UNCONSUMED_LEDGER with a reason. A declared token nobody reads is the
// failure the token gate cannot see: check:tokens proves sources use tokens
// instead of raw values, but not that each token reaches anything rendered.
//
// The predicates live in scripts/lib/token-liveness.mjs (fs-free, unit-tested
// with fixtures); this file only walks the tree, the way
// registry-contract.test.ts does for the registries.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  declaredTokens,
  stripDeclarations,
  stripComments,
  stripCssComments,
  auditLiveness,
  UNCONSUMED_LEDGER,
} from '../../scripts/lib/token-liveness.mjs';
import type { TokenSource } from '../../scripts/lib/token-liveness.mjs';
import { parseTiers, consumedRamps } from '../../scripts/lib/token-tiers.mjs';

const STYLESHEETS = {
  kiosk: 'src/index.css',
  admin: 'src/admin/index.css',
  tokens: 'src/styles/tokens.css',
} as const;

const TOKENS_CSS = STYLESHEETS.tokens;

/** The one tier-aware exception to "a reader is text outside the
 *  declaration line": a tier 1 ramp declared in TOKENS_CSS is legitimately
 *  read only by a tier 2 role declared in the very same file, on a line
 *  that stripDeclarations must remove (it is simultaneously the role's own
 *  declaration). consumedRamps names exactly the ramps a real tier 2 role
 *  points at, in either mode, so it is the one place this gate is told to
 *  stop treating "not found by text search" as "dead", for those specific
 *  names, and only because a second, tested predicate already confirmed the
 *  read. No other token, in any zone, gets this treatment. */
const TIER_AWARE_LIVE = [...consumedRamps(parseTiers(readFileSync(TOKENS_CSS, 'utf8')))];

/** Every source under src/ that could read a token. Tests are excluded on
 *  purpose: a test that writes `var(--x)` proves the name can be typed, not
 *  that anything shipped reads it. Every source is stripped of comments
 *  first (stripComments for .ts/.tsx, stripCssComments for .css, since CSS
 *  has no line-comment form) so a name mentioned only in prose can never
 *  count as a reader; stylesheets are then also stripped of their
 *  declaration lines so they count only through rules that consume. */
function walkSources(dir: string, out: TokenSource[] = []): TokenSource[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSources(full, out);
    } else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      const text = readFileSync(full, 'utf8');
      const isCss = entry.name.endsWith('.css');
      const withoutComments = isCss ? stripCssComments(text) : stripComments(text);
      out.push({ file: full, text: isCss ? stripDeclarations(withoutComments) : withoutComments });
    }
  }
  return out;
}

function tokensOf(sheet: string): string[] {
  return declaredTokens(readFileSync(sheet, 'utf8'));
}

describe('token liveness — every declared token reaches the tree', () => {
  const sources = walkSources('src');

  for (const [zone, sheet] of Object.entries(STYLESHEETS)) {
    it(`${zone}: ${sheet} declares tokens to check (a narrowed walk must not report clean)`, () => {
      expect(tokensOf(sheet).length).toBeGreaterThan(0);
    });

    it(`${zone}: every token in ${sheet} has a reader in src/ or a ledger entry with a reason`, () => {
      const { dead } = auditLiveness(tokensOf(sheet), sources, UNCONSUMED_LEDGER, TIER_AWARE_LIVE);
      expect(
        dead,
        `declared in ${sheet} but read by nothing in src/: ${dead.join(', ')}. ` +
          `Wire a reader, delete the token, or add an UNCONSUMED_LEDGER entry in ` +
          `scripts/lib/token-liveness.mjs with the reason it stays declared.`,
      ).toEqual([]);
    });
  }

  it('the ledger is current: no entry names a token that gained a reader or is no longer declared', () => {
    const all = Object.values(STYLESHEETS).flatMap(tokensOf);
    const { staleLedger } = auditLiveness(all, sources, UNCONSUMED_LEDGER, TIER_AWARE_LIVE);
    expect(
      staleLedger,
      `stale UNCONSUMED_LEDGER entries: ${staleLedger.join(', ')}. The list may only shrink; delete the entry.`,
    ).toEqual([]);
  });
});
