# Local optimization sweep — design

Audit of the working tree on branch `claude/local-folder-optimization-eb398f`
(baseline `c4dcdbc`), and the seven changes it justifies. Written 2026-09-06.

## What the audit measured

Every number below was taken from this tree. The first eight rows were
measured by running the thing named; the last two are derived by reading the
code, and are marked as such, because neither the poll rate nor the face's
render rate has been instrumented on a running Pi.

| Measurement | Value |
|---|---|
| `./scripts/gates.sh` end to end | green, 18.4s wall |
| Vitest | 898 tests across 63 files, 3.4s |
| `dist/` shipped to each Pi by `deploy.sh` | 12 MB |
| ...of which JS + CSS | 1.2 MB |
| ...of which PNG | 11.3 MB |
| ...of which referenced by nothing | 2.9 MB |
| `npm audit` | 12 advisories (6 high, 3 moderate, 3 low) |
| `src/apps/claude-usage/sprites.ts` | 181 KB, 86,400 integer literals |
| Config poll per kiosk (derived from `POLL_MS`) | 1 request / 5s = 17,280 / day |
| Minimalismo React renders while active (derived from the rAF throttle) | ~30 / second |

## What is already right, and must not be disturbed

The audit found no problem in these, and they set the bar for the changes:

- **Lazy per-app chunks.** Every app is its own chunk; the kiosk boot payload
  is two chunks (372 KB raw, 119 KB gzipped) and nothing else loads until an
  app is opened.
- **Zero unused dependencies.** All 16 runtime dependencies have real import
  sites. `framer-motion` is used by five files, `zod` by 36.
- **KIO-1 is clean on the tree.** Every timer outside `src/apps/clock` gates
  on `props.isActive`; the rule catalogue scan reports 0 violations over 173
  files.
- **Static asset caching is correct.** `/assets` is served `immutable`,
  `max-age=1y`, and content-hashed by Vite.
- **Deploy verification is closed.** `deploy.sh` compares `/api/health`'s
  build stamp against the commit it shipped, so a stale bundle cannot pass.

## The seven changes

### 1. Delete orphaned public assets, and gate against regrowth

Nine files in `public/` are referenced by nothing: four 1000x1000 PNGs
(2.9 MB) and five SVGs (20 KB). All nine date from the initial commit
(`f551464`, 2026-04-25) and no source file has ever referenced them.

`public/` ships verbatim into `dist/` and then to every Pi, so these are
2.9 MB of the 12 MB payload that no code path can reach.

Deletion alone does not stop the class. The change adds an asset-liveness
gate in the idiom the repo already uses for tokens and schemas: every file in
`public/` must be referenced by a literal path in `src/`, or sit under a
directory declared to build its paths at runtime. Two such directories exist
(`public/agents/`, from `provider.ts`; `public/fitness/`, from
`ExerciseArt.tsx` and `audio.ts`), and they are declared as data, not
special-cased in the checker.

The gate checks the reverse direction too, and that direction found a live
bug: `index.html` and `admin/index.html` have both linked `/favicon.svg` since
the initial commit, and the file has never existed. Every kiosk and admin boot
takes a 404 for it. The change adds the file.

`public/fitness/README.md` is documentation that currently ships to the Pi.
It moves to `docs/`.

### 2. Downscale the oversized grid and preview art

Sixteen referenced PNGs are 1000x1000. They render at `min(22vw, 22vh)`,
which is 237 px on the 1080 px round display, and smaller again in the admin
cards. At 512x512 they still carry more than 2x the pixels any consumer
asks for.

Resampling in place keeps every path literal valid, so no source file
changes. The filenames are opaque identifiers, not content hashes of the
current bytes, and nothing in the tree verifies otherwise.

This is the only change in the sweep that alters what a display renders, so
it carries a visual verification step rather than a code test.

### 3. Close the dependency advisories

Twelve advisories, six of them high, all in two chains: `react-router` (six
high, reachable from the admin SPA, which is the one surface exposed beyond
the kiosk's own screen) and `qs` plus `postcss` (transitive under Express and
the build).

All twelve are fixed by patch and minor bumps that `npm audit fix` resolves.
Twenty-eight further packages have minor updates available.

Explicitly out of scope: the majors. ESLint 10, TypeScript 7, Vitest 5,
framer-motion 13, `@types/node` 26 and `node-ical` 0.27 each carry their own
migration and none is required to clear an advisory.

### 4. Merge the two agent logs

`AGENT-LOG.md` (12 entries, newest 2026-09-05) and `docs/agent-log.md`
(5 entries, newest 2026-09-06) are the same artifact, duplicated by the
2026-09-06 merge that also left two rule catalogues coexisting.

AGENTS.md names both: line 5 sends agents to `docs/agent-log.md`, line 11 to
`AGENT-LOG.md`. An agent that reads one writes a handoff the next agent does
not find, which is the exact failure the log exists to prevent.

`docs/agent-log.md` becomes canonical: AGENTS.md's primary instruction names
it, and it holds the newest entries. The 12 entries from `AGENT-LOG.md` merge
in by date, the file is deleted, and both AGENTS.md references converge.

### 5. Re-encode the Clawd sprite table

`sprites.ts` stores 13 sprites as 216 frames of 400 integer literals each:
86,400 numbers, 181 KB of source, for pixel art whose runs are long and
highly repetitive. Run-length encoding to base-36 strings measures at 6.6x
smaller, 173 KB of cell literals becoming 26 KB.

The file's header says it is scraped from an upstream source by the
`mac-daemon`, but no generator exists in this repo, so the encoder ships as a
script to give any future regeneration a path.

The chunk is lazy, so this buys repo weight and parse time on the Claude
usage app, not kiosk boot.

### 6. Push config over SSE, demote the poll to a fallback

Each kiosk polls `GET /api/device/config` every 5 seconds. Every poll reads
and parses `config/fleet.json` from disk, and the kiosk shows an admin edit
up to 5 seconds late.

The fleet store already serializes every mutation through one lock, so it is
the natural place to announce a change. It gains an event emitter; a new
`GET /api/device/config/stream` SSE route sends this device's config on
connect and on every subsequent change to it, with a 30-second heartbeat so
an idle connection is not reaped.

The poll stays as the fallback and relaxes to 60 seconds. `EventSource`
reconnects on its own, and the localStorage last-good cache is untouched, so
the offline story does not change.

Net: an admin edit reaches the glass immediately, and idle request volume
drops from 17,280 to 1,440 per device per day.

### 7. Drive the Minimalismo sweep from CSS

`MinimalismoClock` calls `useClockHands(isActive, { sweep: true })`, which
runs a `requestAnimationFrame` loop throttled to ~30fps and calls `setTime`
on every tick. The whole face re-renders 30 times a second, for weeks, on a
Pi 4.

The second hand is one `<line>` rotating about the face centre at a constant
rate. That is what a CSS animation does natively, on the compositor, without
waking React.

The face renders the second hand at angle zero from the same spec numbers it
uses now, and a 60-second linear `rotate` keyframe animation drives it, phase
aligned with a negative `animation-delay` computed at activation. The hook
drops to its default one-tick-per-second mode for the hour and minute hands.

Result: 30 renders/second becomes 1, and the sweep is smoother rather than
coarser because it is no longer quantised to a 33 ms React tick.

Two constraints this respects. The angle stays inside a 60-second loop, so it
never grows to the absolute-epoch magnitude that `useClockHands` documents as
losing precision in the compositor's float32 transform matrix. And it is not
a timer inside `src/apps/clock`, so the ESLint guard behind KIO-3 still holds.

**This changes a face, and AGENTS.md reserves face changes for Nick.** The
rendered geometry, colour and sweep rate are all identical by construction,
so the claim is that this is a mechanism change with no visual consequence.
That claim is verified in a browser before the task is called done, and the
task is ordered last so the rest of the sweep lands whether or not it is kept.

## Out of scope, and why

- **Consolidating the two rule catalogues** (`rules/superclock.json` versus
  `scripts/lib/rules.mjs`). AGENTS.md lists this as an open decision. It is
  Nick's call, not a cleanup.
- **The two default oranges**, the admin's arbitrary-value colours, and the
  dead admin border utilities. All three are listed as open decisions in
  AGENTS.md, and all three change what renders.
- **Major dependency upgrades.** See change 3.
- **`server/fleet-store.ts` read caching.** Change 6 removes 92% of the reads
  that would justify it; caching on top would add an invalidation path for no
  remaining benefit.
- **Chromium GPU flags on the Pi.** Nothing in this tree measures the kiosk's
  paint cost, so any flag change would be a guess dressed as an optimization.

## Verification

Every task ends with `./scripts/gates.sh` green: lint, the token gate, 898+
tests, and a two-SPA production build. Tasks 2 and 7 additionally verify in a
real browser, because neither has a test that can see what they change.
