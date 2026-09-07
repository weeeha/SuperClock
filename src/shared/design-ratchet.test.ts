import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractColours,
  extractFontSizes,
  isBannedHue,
  CEILINGS,
  NOT_DESIGN,
  BANNED_HUE_LEDGER,
} from '../../scripts/lib/design-ratchet.mjs';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// The kiosk surfaces. src/admin is excluded: it is already token-only under
// SYS-1, which the token gate enforces separately.
const files = ['src/apps', 'src/core']
  .flatMap((d) => walk(d))
  .filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f))
  .filter((f) => !NOT_DESIGN.includes(f));

const sources = files.map((f) => [f, readFileSync(f, 'utf8')] as const);

const fontSizes = new Set<string>();
const colours = new Set<string>();
for (const [, src] of sources) {
  for (const s of extractFontSizes(src)) fontSizes.add(s);
  for (const c of extractColours(src)) colours.add(c);
}

describe('kiosk design ratchet', () => {
  it('scans something (an empty walk is a broken map, not a clean tree)', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it(`distinct font sizes stay at or below ${CEILINGS.fontSizes}`, () => {
    expect(
      fontSizes.size,
      `distinct font sizes rose to ${fontSizes.size}. A new size needs a reason — ` +
        `reuse an existing step, or lower the ceiling as part of a design pass.`,
    ).toBeLessThanOrEqual(CEILINGS.fontSizes);
  });

  it(`distinct colours stay at or below ${CEILINGS.colours}`, () => {
    expect(
      colours.size,
      `distinct raw colours rose to ${colours.size}. src/apps sits outside the ` +
        `token gate on purpose, so nothing else stops a new one — reuse a colour ` +
        `already on the tree, or lower the ceiling as part of a design pass.`,
    ).toBeLessThanOrEqual(CEILINGS.colours);
  });

  // Held two ways, like every other ledger here: debt may not grow, and debt
  // that shrank must be re-recorded so the ceiling follows it down.
  it('a ceiling that is now too generous has been lowered', () => {
    expect(
      { fontSizes: fontSizes.size, colours: colours.size },
      'a design pass lowered a count — lower the matching CEILING in ' +
        'scripts/lib/design-ratchet.mjs so it cannot drift back up',
    ).toEqual({ fontSizes: CEILINGS.fontSizes, colours: CEILINGS.colours });
  });

  it('no banned hue outside the ledger, and no stale ledger row', () => {
    const found: Record<string, number> = {};
    for (const [file, src] of sources) {
      const n = [...extractColours(src)].filter(isBannedHue).length;
      if (n > 0) found[file] = n;
    }
    expect(
      found,
      'indigo/violet/purple by hue, not by class name (COL-6 only greps the ' +
        'Tailwind utility, so it has never caught any of these). A face palette ' +
        "is Nick's call — ledger it, never recolour it to pass.",
    ).toEqual(BANNED_HUE_LEDGER);
  });
});
