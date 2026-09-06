// The rule catalog: one record per rule this repo enforces or claims.
//
// A rule and its detector are the same record. `checkedBy` names the npm
// script or vitest file that runs the check; a rule no script can run says so
// in `unchecked`, with what would check it and who enforces it meanwhile.
// check:tokens prints the unchecked ones at the end of every run, so a green
// gates run always ends by naming what nobody inspected. rules.test.ts keeps
// the record honest: every `checkedBy` must resolve to something real.
//
// The `why` is not decoration. A bare "don't" reads as arbitrary and gets
// rationalised away in the next session; the reason is what survives.
//
// Lineage: ds-architecture (rule-as-record, declared un-checkability). The
// prose in AGENTS.md stays the readable copy; this is the copy the gates run.

export const RULES = [
  {
    id: 'R01',
    statement:
      'src/admin and src/core reach CSS through tokens: no raw hex, no raw colour function, no Tailwind palette class',
    why: 'a raw value is a decision the design system did not make; night mode and rebrands cannot reach it',
    checkedBy: 'npm run check:tokens',
  },
  {
    id: 'R02',
    statement:
      'text-muted-foreground never pairs with bg-muted, bg-accent or bg-secondary in one class list or across a cva base and variant',
    why: 'shadcn muted-on-muted lands at 4.34:1 against the 4.5:1 AA minimum',
    checkedBy: 'npm run check:tokens',
  },
  {
    id: 'R03',
    statement:
      'every face imported by face-components.ts reads a --face-* token (legacy exemptions in FACE_TOKEN_EXEMPT, shrink-only)',
    why: 'night mode is a --face-* palette flip; a face that never reads the tokens silently ignores night',
    checkedBy: 'npm run check:tokens',
  },
  {
    id: 'R04',
    statement:
      'every token declared in src/index.css or src/admin/index.css has a reader in src/, or an UNCONSUMED_LEDGER entry with a reason',
    why: 'a declared token nobody reads looks finished in the CSS while the pixel it promises never moves',
    checkedBy: 'src/shared/token-liveness.test.ts',
  },
  {
    id: 'R05',
    statement: 'the app, face and schema registries name the same set of ids',
    why: 'an id missing from one list is an app the admin can configure but the kiosk cannot show, or the reverse',
    checkedBy: 'src/shared/registry-coherence.test.ts',
  },
  {
    id: 'R06',
    statement: 'no app directory, schema file, face component or preview image exists outside its registry',
    why: 'coherence pins the lists against each other; only filesystem-vs-registry can catch a file that reached no list',
    checkedBy: 'src/shared/registry-contract.test.ts',
  },
  {
    id: 'R07',
    statement: 'every navigation action that sets mode transitioning also changes the SwipeContainer render key',
    why: 'an unchanged key means no exit animation, finishTransition never fires, and every gesture stays gated off',
    checkedBy: 'src/core/navigation.test.ts',
  },
  {
    id: 'R08',
    statement: 'no setInterval inside src/apps/clock; hand angles come from useClockHands only',
    why: 'two tickers drift against each other and a leaked interval keeps a background face burning CPU on a Pi',
    checkedBy: 'npm run lint',
  },
  {
    id: 'R09',
    statement: 'one saturated accent quantity per face, at day and at night',
    why: 'the three-faces study found a second accent competes with the time and the face stops reading at a glance',
    unchecked:
      'needs a rendered pass over every face in both palettes; no renderer-level check exists. Review-enforced until the face spec carries the accent as data.',
  },
  {
    id: 'R10',
    statement: 'a face shipped on both React and LVGL keeps geometry, palette and night behaviour in sync',
    why: 'the Slow Pi renders natively; a React-only change silently forks the one face both sides share',
    unchecked:
      'two renderers and no shared face spec to diff; the face-spec-as-data step is the fix. Review checklist item until then, capped at Minimalismo.',
  },
  {
    id: 'R11',
    statement: 'AA contrast (4.5:1) on the actual surface, in both the day and the night palette',
    why: 'the kiosk is read across a room and the admin on a phone; contrast is the floor, not a polish item',
    unchecked:
      'no axe or contrast gate exists; the Minimal-Design-System pattern (an axe run per story in real Chromium, jsdom skips color-contrast) is the port. Checked by eye today.',
  },
  {
    id: 'R12',
    statement:
      'the unslop Phase 2 greps come back empty: no gradients, blur, transition-all, animate- outside the ambient apps, emoji in chrome, or banned copy',
    why: 'each is a named AI default that reads as a faked decision; counts beat vibes',
    unchecked:
      'run by hand from .claude/skills/unslop/SKILL.md; only the token slice (R01) is scripted. A grep script in gates.sh would close it.',
  },
  {
    id: 'R13',
    statement: 'timers and animation frames outside src/apps/clock gate on props.isActive',
    why: 'the grid overlay deactivates the app under it; a background ticker is real heat on a Pi that runs for weeks',
    unchecked:
      'the lint ban covers setInterval inside src/apps/clock only; other apps are review-enforced. A lint rule scoped to src/apps would close it.',
  },
  {
    id: 'R14',
    statement: 'an app that fetches shows an explicit offline or stale tell; fallback or mock data never renders as live',
    why: 'a clock that shows yesterday as today is worse than a clock that says it is offline',
    unchecked:
      'no detector for a missing tell; WeatherApp and GithubApp are the reference implementations, review-enforced. A story-per-state gate would close it.',
  },
  {
    id: 'R15',
    statement: 'secrets stay server-side: no VITE_-prefixed variable carries a token, key or secret',
    why: 'VITE_ names are inlined into the public bundle that every Pi serves on the LAN',
    unchecked:
      'no grep guards VITE_ names; the calendar, github and claude-usage proxies are the pattern. A name-pattern check over import.meta.env reads would close it.',
  },
  {
    id: 'R16',
    statement:
      'every face and kiosk widget carries a .meta.json beside its component, and every claim in it (night tokens read, option keys, parity path, geometry state) is true of the source',
    why: 'a judgment nobody wrote down gets inferred wrong; a claim nobody checks drifts the first time the component changes',
    checkedBy: 'src/shared/part-contracts.test.ts',
  },
];

/** The rules with no detector: what a green run did not inspect. */
export function uncheckedRules(rules = RULES) {
  return rules.filter((r) => !r.checkedBy);
}

/** One line per unchecked rule, for the end of every check:tokens run. */
export function formatUnchecked(rules) {
  return rules.map((r) => `  ${r.id}  ${r.statement}. Unchecked: ${r.unchecked}`).join('\n');
}
