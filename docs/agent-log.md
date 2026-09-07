# Agent log

What each agent session did to this repo, newest first. Read it before starting work. Append an entry at the end of every work chunk, not only at session end. Entries are factual: what changed (file paths), what was verified and how, decisions taken, what is still open. Never rewrite an older entry; add a new one that corrects it.

Work on this repo lands as local code changes. Do not open or wait on pull requests unless Nick asks for one.

---

## 2026-09-07 · branch claude/local-folder-optimization-eb398f · second deploy, and a false negative in the deploy's own check

**fastclock now runs `a672589`** — every commit through the scales work — verified by build stamp, and Chromium was restarted (`pkill -TERM chromium`, labwc autostart relaunches) so the glass is showing it rather than the 3h25m-old page it was holding.

**The self-verifying deploy reported a failure for a deploy that had landed perfectly (`a672589`).** It printed "server did not come back within 60s"; the device was healthy in ~6s and serving the exact shipped commit. That is worse than having no check: a false negative on the one mechanism that answers "did my deploy land" teaches you to ignore it.

Cause: `--max-time` covers DNS as well as the request, and resolving a `.local` name from macOS costs more than the 3s budget. Measured three consecutive attempts hitting the ceiling at exactly 3.01s — so `curl -f` failed every iteration, `HEALTH_JSON` stayed empty, and **the loop could never have passed against a `.local` host, however long it ran.** Every previous "successful" verification must have been against an IP or a faster resolver.

Fixed: ssh has already proven reachability by that point, so the script asks the device for its own address and polls that, falling back to the passed-in host. The budget also splits into `--connect-timeout 3` plus `--max-time 8`, so slow is distinguishable from unreachable. Re-ran the whole deploy end to end and it verified green.

**Sequence worth noting for anyone reading the last two entries together:** the first deploy today wiped the device's photo library (fixed, `071313d`), and the second one exposed the verification as structurally broken. Both were latent in a script described in AGENTS.md as "guarded and self-verifying". It is now closer to both.

**Open:** still nothing seen on the actual panel by a human — everything here is stamps, logs and DOM reads. The Minimalismo drift fix and all of today's design work are now ON the device, so that observation is finally possible.

---

## 2026-09-07 · branch claude/local-folder-optimization-eb398f · the three open decisions, resolved and built

Nick made all three calls; the third he delegated ("make recommended decisions").

**1. Floral's violets — artistic faces exempt (`ab734ee`).** COL-6 now governs chrome and data encodings, not a face in the `artistic` category. Floral's five petal violets are allowed rather than ledgered; three rows remain, all colour standing for data (Productivity's progress quantity, a Complications Dark tile, the extreme-UV weather step). The exemption reads `face-registry.ts` for the category and `face-components.ts` for the file, so a new artistic face is covered and a recategorised one loses it. **A bug worth remembering:** the first regex scanned from an `id:` forward to the nearest `category: 'artistic'`, walking out of its own entry — it exempted Square and Daylight, two faces with no purple in them, while leaving Floral still ledgered. Confidently wrong rather than erroring. A negative lookahead on `id:` fixed it.

**2. Habits month view — density ring (`b457610`).** Seven concentric rings of 31 segments in seven saturated primaries became one ring whose bands grow outward and brighten with how many habits were done that day. Day marks at 1/8/15/22/29; centre shows the month's percentage over ELAPSED days only (dividing by the whole month reports a falling score daily for no reason); empty state is now a sentence. Dropped: per-habit history, the accepted cost — the daily view names every habit but only for today, so that has no home yet. Also dropped seven per-habit Gaussian blurs, which were seven blurred layers a frame on a Pi 4.

**3. The scales — defined (`15da6d5`).** `src/shared/kiosk-scale.ts`: `TYPE` (5 steps from the real frequency peaks) and `GREY` (7 steps from the most-used lightness values among the 44 near-greys). Two calls made rather than asked: face display numerals stay OUT of the type scale (280 and 168 are a dial's proportions, and a face's look is the product), and only true neutrals join the grey ramp (GitHub's #8b949e and the Fitness cream face's #8b8279 are designs, not drift). Three exact-duplicate pairs collapsed for zero pixel change: colours 121 → 118.

**The ratchet earned itself twice today.** It refused the Habits rewrite because I had introduced `#232323`, a grey one shade off ones already present — reused `#1e1e1e` instead. And the token-liveness gate refused the grey ramp when I first declared it in `@theme`, because nothing read those seven tokens; that is what moved both scales into TypeScript, which is where they belonged anyway since they are SVG presentation attributes.

**Verified:** gates green after each commit, 939 tests. Habits rendered with seeded data (30 segments, bands at 166 and 99 units for 5/7 and 3/7, day marks, "55% of September"). The last Habits tweak was confirmed by reading the rendered DOM, not by eye — the browser pane was hidden and could not composite.

**Open:** none of this is deployed; fastclock still runs `3cbc8ba`, which predates every commit from the drift fix onward. Migration of apps onto the two scales. Quote, Images and Breathing never looked at. And still, nothing seen on the actual glass.

---

## 2026-09-07 · branch claude/local-folder-optimization-eb398f · first deploy to fastclock, and what it cost

Nick ran `DEPLOY_ANYWAY=1 bash scripts/deploy.sh nickv2026@SuperClockFast.local` (the classifier blocked the agent from running it; the command was handed over instead).

**Deploy verified.** `/api/health` reports `3cbc8ba` on branch `claude/local-folder-optimization-eb398f`, matching the shipped commit; the server restarted (uptime 3s). fastclock was on `b88dc81`/main before this.

**It destroyed the device's photo library, and that is a class, not an accident (`071313d`).** `public/photos/*` is gitignored, so a clean checkout builds an EMPTY `dist/photos/`, and `rsync --delete` on `dist/` mirrored that emptiness onto the Pi. `test1.jpg`, `test2.jpg`, `test3.jpg` are gone with no surviving copy. Every deploy from every machine has done this. deploy.sh already reasons about exactly this hazard for `config/` ("device-local state that must survive deploys") but photos sit *inside* the mirrored directory, so that carve-out could not reach them. Fixed with `--filter='protect photos/***'`, which forbids deletion while still allowing new photos to be sent, and proven both ways against the real device with a planted probe file.

**The Minimalismo sweep drifts when the document is hidden, measured on the deployed build (`223a44d`).** A constant 133° (~22s) error, holding steady — right rate, wrong phase. A hidden document pauses the animation timeline; the `visibilitychange` handler only fires on a transition and a document hidden from load never emits one, so the scheduled re-align was the real bound. It was 5 minutes. Now 60s, which must stay a whole number of minutes so the remount lands at 0° where it cannot be seen. Caveat recorded in the commit: this was a hidden tab, and the Pi runs Chromium fullscreen where the document should never be hidden — but "should" was the problem with 5 minutes.

**Method note worth keeping.** The first reading of that drift looked far worse because the angle was computed from `anim.currentTime` alone, which excludes the negative `animation-delay` that sets the phase. Adding the delay back made the computed angle match the rendered transform matrix exactly — which is what made the residual constant error trustworthy rather than a measurement artifact.

**Three facts about the device, found while verifying:**
- `window.__nav` is stripped from production builds, so device navigation cannot be driven programmatically the way the dev preview allows. Real gestures or config are the only levers.
- `POST /api/device/config` returns 401 on fastclock: it has `config/admin.json` provisioned, so the write surface is token-gated. Correct behaviour, and not worked around.
- fastclock is on **192.168.4.30**. `CLOCK_SPECS.txt` records 192.168.4.28. The `.local` name resolves correctly so nothing is broken, but the doc is stale.

**Still not verified:** the panel itself. Everything above was read through a browser pointed at the device, at a true 1080×1080 viewport, which settles resolution and served-build questions but not what the glass looks like from across the room. The drift fix is committed and NOT deployed.

---

## 2026-09-07 · branch claude/local-folder-optimization-eb398f · design passes: Todo, Fitness, Complications; Habits assessed

Continues the pass below. Nick's call was "design-pass more apps", worst-first.

**Todo (`4c9d014`).** Ticks, cross and the mini-keyboard's space and backspace were text glyphs doing icons' jobs. Now lucide `Check` / `X` / `Space` / `Delete` at 26, sized to the 24px letter keys beside them, with accessible names they never had. `U+2423` and `U+232B` sit outside even the widened ICO-2 range, so the gate had no opinion on them; they went for the same reason.

**Fitness (`3181bb9`).** Streak hearts were `❤️`, drawn now — and drawn in the face's *ink*, not red, because the progress ring is already that screen's one saturated quantity. The paused readout was a `'❚❚'` headline, i.e. the view model spelling a picture; it is a `paused` flag now and the face draws two bars.

**Complications (`2f594e4`).** The caffeine `☕` is drawn in a shared `CaffeineMark.tsx`. This is a face, so what changed is the rendering of one icon, not palette, geometry or composition.

**Emoji debt: 17 → 1.** The last is `src/apps/todo/index.ts`'s registry `icon`. That field is DEAD — the kiosk never renders it and the admin's tile art comes from `APP_ICONS` — and all fourteen apps carry one, thirteen behind a `\u{...}` escape. Deleting it is a fifteen-file types change, not a design pass, so it is left with its reason recorded.

**Two corrections to my own earlier claims, both found by checking rather than assuming:**
- The Complications demo values are NOT unlabelled. Both demo tiles already carry a "DEMO" row and the habit ring is live from HabitsApp storage; the board's fabrication concern was closed before this pass. That was the stated reason the face was queued, and it was stale.
- The Complications weather tile is NOT an emoji. It is a drawn sun and two ellipses. It looks like one in a screenshot because it is full colour on a monochrome face — a real observation, but a different one.

**The design ratchet paid down for the first time**, and forced it: dropping the fitness emoji removed `fontSize` 58, nothing else used it, the count fell 61 → 60 and the gate failed until `CEILINGS.fontSizes` followed.

**Habits: assessed, not changed.** Seeded a month of completions and rendered the month-ring view. The board's "7 rings × 31 segments" risk is real: seven fully saturated primaries compete at once (#FF3333 beside #19A340 beside #0044FF), there are no day labels, and habit identity is carried only by seven ~6px dots under the date. It reads as decoration rather than data. Its empty state is worse — with no completions it is concentric near-black rings with no message, where the state kit calls for a sentence and a creating action. **Not redesigned: choosing the replacement encoding (one hue by lightness, a harmonised palette, or a density ring plus legend) is a design decision with several valid answers and is Nick's.**

**Verified:** gates green after every commit, 938 tests. Each pass rendered and read in the browser: Todo's four keyboard icons and their labels plus the done badge, Fitness on both the work and paused faces, the caffeine cup in its tile with the layout unmoved.

**Open:** nothing here is deployed or seen on a real panel. Habits' encoding. The 8 banned-hue rows (Floral's five violets especially — whether COL-6 is meant to apply to an artistic face is unresolved). 60 font sizes and 121 colours still frozen rather than reduced. Quote, Images and Breathing not yet looked at.

---

## 2026-09-07 · branch claude/local-folder-optimization-eb398f · design enforcement + Weather and Fireplace passes

Follow-on from the board audit below. Nick's call was "close the enforcement holes first, then redesign the two apps".

**Enforcement (2 commits).**
- `318b914` ICO-2 read "zero emoji in chrome" at blocker severity while matching only `U+1F300-1FAFF` plus sparkles, so all of Misc Symbols and Dingbats walked past it. Widened to the pictograph planes, `U+2600-27BF`, `U+2B00-2BFF` and `U+FE0F`; the selector also catches weather's three `\u{...}`-escaped glyphs, the blind spot the rule's own note described. Surfaced 17 pre-existing hits in 8 files, recorded in `BASELINE` rather than fixed, each row naming the substitution it waits for.
- `20cf85e` `scripts/lib/design-ratchet.mjs` + `src/shared/design-ratchet.test.ts` (new). `src/apps` sits outside SYS-1 on purpose, so nothing measured what that cost: **61 distinct font sizes** against unslop's budget of 7, and **121 distinct raw colours**. Both frozen, shrink-only, held two-way. It also computes hue to catch COL-6's banned indigo/violet/purple, which that rule cannot see because its detector greps Tailwind class names and every occurrence here is raw hex: 8 hits in 4 files, ledgered not recoloured.

**Weather (`2dce94e`).** The conditions dial rendered stock colour emoji. `src/apps/weather/ConditionMark.tsx` (new) draws nine marks — sun, moon, partly, cloud, fog, rain, snow, snow shower, storm — filled at one weight, in a 48-unit box, coloured through `currentColor` so the dial's existing `colorOf` and its 55% night dimming reach them. `Dial` gains an optional `markOf`; every other page stays on text. Paid 8 of the 17 ICO-2 rows.

**Fireplace (`a6119e4`).** Particles were hard-edged `arc()` fills in source-over. Now a 12-bucket pre-rendered soft sprite sheet drawn with `lighter`, which is both softer and cheaper than building a gradient per particle. Ember bed became a disc instead of a full-width rect (two thirds of it was off the round glass), the spawn bed curves to follow the disc, and outer particles rise slower so the fire mounds instead of standing as a column. The trail smear is untouched.

**Verified:** gates green at every step, 938 tests. Weather's mark set reviewed on a contact sheet at shipping size in both day and night opacity. Fireplace judged by re-running its own simulation at full rate in-page.

**Found:**
- Both HTML shells had linked a `/favicon.svg` that never existed (fixed in the earlier sweep).
- The crescent moon shipped as a hairline on first draw: a crescent is two arcs between the same points, and setting the large-arc flag on the return makes it bulge the same way as the outer edge.

**Open:**
- **Nothing here is deployed or seen on a real panel.** Fireplace especially: the still is right, the motion needs a device. The preview pane keeps the page `document.hidden`, which throttles rAF to almost nothing.
- 9 ICO-2 rows remain across 7 files: the caffeine cup on both Complications faces, fitness hearts and pause bar, todo's ticks/cross/registry icon. Each is app or face visual design, which AGENTS.md reserves for Nick.
- The 8 banned-hue rows, likewise. Whether COL-6 is even meant to apply to an artistic face (Floral's whole subject is flowers) is unresolved.
- 61 font sizes and 121 colours are frozen, not fixed. Lowering either is a design pass per app.
- `codeGlyph` is gone; anything outside this repo that imported it needs `codeMark`.

---

## 2026-09-07 · branch claude/local-folder-optimization-eb398f · local optimization sweep, seven tasks

Spec `docs/superpowers/specs/2026-09-06-local-optimization-design.md`, plan
`docs/superpowers/plans/2026-09-06-local-optimization.md`. Seven commits, `7846c0c` to `1f39098`.

**Changed:**
- `scripts/lib/asset-liveness.{mjs,d.mts,test.ts}`, `src/shared/asset-liveness.test.ts` (new): public/ liveness gate. Nine orphaned assets deleted, `public/favicon.svg` added, `public/fitness/README.md` → `docs/fitness-art.md`.
- Sixteen 1000x1000 PNGs in `public/` resampled to 512px in place. No source file changed: the filenames are opaque identifiers, not content hashes.
- `package-lock.json`: `npm audit fix` only. `package.json` untouched.
- `AGENT-LOG.md` deleted into this file; `AGENTS.md` line 11 and `scripts/lib/docs-drift.test.ts` follow.
- `src/apps/claude-usage/sprite-codec.{ts,test.ts}`, `scripts/encode-sprites.mjs` (new); `sprites.ts` and `ClawdSprite.tsx` re-encoded to run-length strings.
- `server/fleet-store.ts` (event emitter), `server/device-routes.ts` (`GET /api/device/config/stream`), `server/config-stream.test.ts` (new), `src/shared/local-config.ts` (`startConfigSync`/`stopConfigSync`, poll 5s → 60s), `src/App.tsx`.
- `src/index.css` (`.face-sweep` keyframe), `src/apps/clock/MinimalismoClock.tsx` (second hand driven by CSS).

**Measured, before → after:** `dist/` 12.5 MB → 5.99 MB. `public/` 8.36 MB → 4.98 MB. `sprites.ts` 181 KB → 33 KB, its built chunk 188 KB → 40 KB. `npm audit` 12 advisories (6 high) → 0. Config requests per device per day 17,280 → 1,440. Tests 898 → 919, gates green throughout.

**Verified:** every task ends on `./scripts/gates.sh` green. Beyond that: the asset gate was mutation-checked (a planted orphan fails by name); the resampled art was checked in a browser across the kiosk grid and the admin face gallery, 0 broken images, no 404s; the SSE stream was driven against a real server with curl and in the kiosk, where a config change reached the glass in 933ms with zero polls in a 12.7s window, and 15 connect/disconnect cycles produced no MaxListenersExceededWarning; the sprite codec round-trips all 86,400 cells and the canvas paints and animates; the Minimalismo sweep was driven through the Web Animations API and lands within 0.000° at seven wall-clock seconds, moving forward through the minute wrap.

**Found while working, each recorded in its commit:**
- Both HTML shells have linked `/favicon.svg` since the initial commit and the file never existed, so every kiosk and admin boot took a 404.
- The first sprite format was ambiguous: with a base-36 index, `[0,1,0,1,2]` encoded to `"01012"` and read back as 1012 zeros. The round-trip test caught it. Letters index the palette and digits count the run precisely so the two alphabets cannot overlap.
- A CSS-driven sweep introduces a regression the rAF loop did not have: a hidden document pauses the animation timeline and resumes where it stopped, not where the wall clock is. Closed with a `visibilitychange` re-align.

**Decisions:**
- `docs/agent-log.md` is canonical over `AGENT-LOG.md`; AGENTS.md's primary instruction named it and it held the newest entries.
- The 28 remaining minor dependency updates were NOT taken. A blanket `npm update` reproducibly breaks the tree 24 type errors and 7 lint errors deep, in code this sweep never touched. See `e50eff6` for the three distinct causes. None carries an advisory, so nothing is at risk by waiting.
- `eslint-plugin-react-hooks` stays at 7.0.1. 7.1.1 flags six pre-existing `set-state-in-effect` violations and one ref-during-render; fixing them changes behaviour in calendar, weather, complications, playlist and two admin routes.

**Open:**
- **Nothing here has been deployed or seen on a real display.** The Claude preview pane keeps the page permanently `document.hidden`, which suspends rAF and the animation timeline, so the Minimalismo sweep could not be watched running and the 30-to-1 renders-per-second claim is read off the code path taken, not measured. That is the one claim in this sweep resting on reasoning rather than observation.
- The Minimalismo change touches a face, and AGENTS.md reserves face changes for Nick. Geometry, colour and sweep rate are identical by construction and verified numerically, but he has not seen it.
- `useClockHands`'s `sweep` option now has no consumer and no test. Removing it touches a file every face depends on.
- The seven `set-state-in-effect` violations above, and the dependency-minor bisect.
- Still coexisting, untouched here: the two rule catalogues.

---

## 2026-09-06 · branch claude/local-folder-optimization-eb398f · the two agent logs merged into one

**Changed:** `AGENT-LOG.md` deleted, its 12 entries appended to this file below the provenance note; `AGENTS.md` Project-context line now names `docs/agent-log.md`, matching the instruction at the top of the file; `scripts/lib/docs-drift.test.ts` exclusion regex updated, since it named a file that no longer exists.

**Why:** AGENTS.md line 5 sent agents to `docs/agent-log.md` and line 11 to `AGENT-LOG.md`. An agent that read one could write a handoff the next agent never found, which is the single failure this log exists to prevent.

**Decision:** `docs/agent-log.md` is canonical — AGENTS.md's primary instruction names it and it holds the newest entries.

**Verified:** `./scripts/gates.sh` green; no reference to the deleted filename survives outside historical entry text.

**Context:** task 4 of the seven-task sweep in `docs/superpowers/plans/2026-09-06-local-optimization.md`.

---

## 2026-09-06 · branch claude/project-brainstorming-e32502 · face contracts: review round and closing state

Appended by the session controller after the entry below. That entry describes the branch at commit `90ff162`; three commits landed after it, all test-only or documentation, and this records them plus what the reviews found.

**Changed after `90ff162`:**
- `72cc761`: two corrections to the entry below. It claimed its gates run was the first on this branch, which the step-1 entry further down contradicts, and it paraphrased a mutation-check failure message with a word the assertion does not use.
- `adefcf7`: five new assertions in `src/shared/lvgl-parity.test.ts` and `src/shared/part-contracts.test.ts`, closing four defects a whole-branch review found. No component, meta, C source or production file changed.

**What the whole-branch review found.** Every task passed its own review, and the branch still carried three places where a gate could report green on the defect it exists to catch:
1. The parity gate treated an unreadable colour as ledgered drift. `parseColors` returns null for a colour it cannot parse and four ledger entries swallowed that null, so renaming the C dial object, or writing its colour in a form the parser does not recognise, kept the gate green. The damaging case: if the C clock were actually reconciled with React but written unrecognisably, the gate would pass while the ledger kept asserting a difference that no longer existed, and the shrink-only list would never shrink. Closed by two checks that every C colour resolves to a string and that every `make_hand` and `make_dot` call the spec expects has a match, the second because a renamed call leaves its key absent rather than null.
2. Widget contract coverage rested on a hardcoded list, so a new file under `src/core/widgets/` with no contract was invisible to the gate, to the index, and to the index's own coverage assertion, which compared against the same list and was therefore circular. Closed by globbing the directory, plus an orphan check for a stray meta there.
3. Nothing kept a migrated face free of geometry literals after day one. The gate checked only that the face imports its contract, so hardcoding `strokeWidth="28"` back into Analog while keeping the import stayed green, and the meta would have become a lie about React that the parity test structurally cannot see. Closed by asserting no spec number appears as a bare geometry attribute value in the face's own source.
4. Minor, same class: nulling a spec section stopped it being compared. `ticks` was caught indirectly through stale ledger entries, `dot` by nothing. Closed by asserting a parity face carries both.

Each new assertion was demonstrated failing on the defect it names, then the tree restored.

**Verified:** `./scripts/gates.sh` green on this final state: lint clean; check:tokens (47 semantic-zone files and 13 faces clean, 7 legacy faces exempt, 7 tokens ledgered, 6 rules with no detector); 510 tests across 42 files; both-SPA production build.

**Open, and deliberately not fixed here:**
- `hands.second` in `src/shared/lvgl-parity.test.ts` has the same silent-skip exposure that item 4 closed for `ticks` and `dot`: no ledger entry references it, and the comparison skips its whole block when null. The guard's own cited precedent in `AnalogClock.tsx` covers all three fields, so this is a one-line, same-shape addition. Left as a follow-up rather than a second fix wave.
- Twelve Minor findings from the per-task reviews were triaged by the whole-branch reviewer as non-blocking. The largest is that the four shrink-only lists (`FACE_TOKEN_EXEMPT`, `UNCONSUMED_LEDGER`, `SPEC_PENDING`, `PARITY_DRIFT_LEDGER`) do not share one idiom: two carry a reason per entry and a staleness check, `SPEC_PENDING` is a bare string array, and `FACE_TOKEN_EXEMPT` has neither. Giving all four the same shape is the single largest thing between this and a layer the next session can read as one thing.
- The plan at `docs/superpowers/plans/2026-09-05-face-contracts.md` prescribes code that does not compile under this repo's strict settings in three places, each the same narrowing mistake. Anyone copying from it will hit it again.

**Waiting on Nick:** the fifteen contract files' judgments are drafts written from the specs and the board, and none has been read by a human. Which renderer is right in the nine ledgered React-versus-LVGL mismatches is his call, not the gate's. StateRing's eventual home is still open.

---

## 2026-09-06 · branch claude/project-brainstorming-e32502 · design-system step 3: face and widget contracts built

**Changed:**
- `src/shared/part-meta.ts` (new): `faceMetaSchema`/`widgetMetaSchema` (zod), `SPEC_PENDING` (shrink-only, 6 entries), `resolveSpecColor`, `specOf`. `src/shared/part-meta.test.ts` (new, 155 lines): fixture coverage for every field and gate, including every schema rejection reason.
- `src/shared/part-contracts.test.ts` (new): the real-tree gate (R16), one check per row of the spec's gates table: meta validity, one meta per part, every claim (night tokens, option keys, parity path, `insteadUse`), geometry state, and structural read for a face carrying `spec`.
- Fifteen meta files (new), one per part: thirteen faces (`src/apps/clock/{MinimalismoClock,AnalogClock,ProductivityClock,SquareClock,FloralClock,ComplicationsLight,ComplicationsDark,WorldClock,FlipClock,DepletionClock,ApertureClock,DaylightClock,StrokesClock}.meta.json`) and two widgets (`src/core/widgets/RoundList.meta.json`, `src/apps/agents/StateRing.meta.json`). `scripts/lib/token-rules.d.mts` (new): hand-kept types so the contract test can import `token-rules.mjs` under strict `src/` typechecking.
- `src/apps/clock/AnalogClock.tsx` + `AnalogClock.meta.json`: Analog now draws every hand, tick and dot number from `meta.spec`; the numeral ring radius (340) stays a literal on purpose, outside the spec vocabulary.
- `src/apps/clock/MinimalismoClock.tsx` + `MinimalismoClock.meta.json`: the same move, six numbers and the gold second-hand colour.
- `scripts/lib/lvgl-parity.mjs`/`.d.mts`, `scripts/lib/lvgl-parity.test.ts` (new, fixtures), `src/shared/lvgl-parity.test.ts` (new, real tree): `parseGeom`/`parseColors` read `slow-native/src/clock_face.c`, `compareToSpec` diffs it against the Analog spec, `PARITY_DRIFT_LEDGER` names the 9 known mismatches.
- `scripts/lib/parts-index.mjs`/`.d.mts`, `scripts/build-index.mjs`, `index/parts.toon` (new, 15 rows), `scripts/lib/parts-index.test.ts` (fixtures), `src/shared/parts-index.test.ts` (new, drift gate, R17). `package.json`: `build:index` script.
- `scripts/lib/scaffold-templates.mjs` (`faceMetaTemplate`), `scripts/new-face.mjs`, `scripts/lib/scaffold-templates.test.ts`: `npm run new:face` now writes a `TODO`-stubbed meta alongside the component, so a scaffolded face is red on the contract gate until its judgments are filled in, the same way its todo test is red until implemented.
- `scripts/lib/rules.mjs`: R10 gains `checkedBy: src/shared/lvgl-parity.test.ts`; new R16 (`src/shared/part-contracts.test.ts`) and R17 (`src/shared/parts-index.test.ts`).
- `AGENTS.md`: a new Conventions bullet ("Parts carry contracts"), the LVGL parity line corrected from "currently Minimalismo" (doc drift, recorded in the previous entry) to Analog, and the Known-gaps R09/R10 bullet rewritten to say R09 is now declared as data and R10 is gated.
- `docs/superpowers/specs/2026-09-05-face-contracts-design.md`: changelog line for this implementation.

**Verified:** `./scripts/gates.sh` green end to end: lint clean; check:tokens (47 semantic-zone files and 13 faces clean, 7 legacy faces exempt, 7 tokens ledgered, 6 rules with no detector: R09, R11, R12, R13, R14, R15; R10 is no longer among them); 504 tests across 42 files; both-SPA production build, `build-info.json` stamped `fed4d1c`.

Mutation-checked four of the new gates, each file restored to its committed state afterward and the full suite re-run green (504/504): a phantom night token added to `AnalogClock.meta.json` fails `part-contracts.test.ts`, naming the part, the token, and the file that does not read it; deleting the `radius` line from `PARITY_DRIFT_LEDGER` fails `lvgl-parity.test.ts` as an unledgered drift, printing the exact react/lvgl values; hand-editing one field of the `analog` row in `index/parts.toon` fails `parts-index.test.ts` with a line-level diff against a fresh emit; re-adding `analog` to `SPEC_PENDING` (it now carries `spec`) fails `part-contracts.test.ts`, naming the face and telling you to delete its SPEC_PENDING line.

Pixel identity for Analog and Minimalismo: verified, by two methods instead of the stash-and-diff the plan suggested (stashing is off-limits here, the stack is shared across worktrees). First, analytically: every literal removed from each TSX in Tasks 3 and 4 was traced to the exact meta number it now reads, against the pre-migration source (`git show <parent commit>:<path>`). Second, live: `npm run dev` on port 5180, driving `window.__nav.getState().verticalSwipeCallback('down')` from the browser console to cycle ClockApp from its default face to each target, then reading `document.querySelector('svg').outerHTML`.
- Minimalismo: byte-identical. `handPoints` still receives the same 280/380/350-tip, 80-tail, 6/28/20-width numbers, and the second hand's colour is the same literal `"#FFD700"` string before and after. The only difference between two readings is the hand-angle trig, which moves with real time regardless of this change.
- Analog: every position, width, and the second hand and both dot fills (which resolve through the same `accent` config value either way) match exactly: 60 ticks plus 3 hands render as 63 `<line>` elements, 3 `<circle>` elements, and numerals are off by default so their colour is not in play. The one textual difference is how the ink colour is written: the old tick, hour-hand and minute-hand strokes read `stroke="currentColor"` inherited from a `<g className="text-white">` wrapper (the hands used the literal `"white"` keyword directly); the new code writes the resolved `"#ffffff"` literal on each element and the wrapper class is gone. The rendered colour is identical: `getComputedStyle` on a `color: white` node and a `color: #ffffff` node in the running page both report `rgb(255, 255, 255)`.

**Decisions:**
- The parity ledger carries 9 mismatches between React Analog and the LVGL `clock_face.c`, none fixed here (AGENTS.md: a red check on a deliberate design is a conversation, not a fix-forward; which renderer is right is Nick's call):
  - `face.background`: React draws a black dial, the C a white one.
  - `face.ink`: React ink is white on black, C ink is black on white (follows the background decision).
  - `face.ink.tick`: React draws tick marks in ink (white), the C ticks are black (follows the background decision).
  - `face.ink.minute`: React's minute hand is ink (white), the C minute hand is black (follows the background decision).
  - `radius`: React fills the whole 1000 disc; the C draws a 460 face inside a black backdrop.
  - `ticks.hour.outer`, `ticks.hour.inner`, `ticks.minute.outer`, `ticks.minute.inner`: all four sit 40 units inside the React ticks because the C face radius is 460, not 500.
- Six faces stay on `SPEC_PENDING`, numbers still in the TSX, each its own future change: `productivity`, `square`, `floral`, `complications-light`, `complications-dark`, `world`.

**Found:**
- Task 5's own review round found that `compareToSpec` read the hour hand's colour but never the tick colour or the minute hand's, so a C-only edit to either one would never surface as a mismatch (shown empirically, by mutating each independently). Both checks were added, against the same `spec.face.ink`; two more real mismatches (`face.ink.tick`, `face.ink.minute`) surfaced and are ledgered above, taking the ledger from 7 entries to 9. Neither renderer was touched to chase green.
- The plan's own prescribed code hit the same TypeScript gap three times (Tasks 3, 4, 5): a value read from an optional or nullable field (`spec.hands.second`, `spec.ticks`, `spec.dot`), or from an array element narrowed by `.filter()` (`meta.parity.lvgl`), is not narrowed at the point it is later used, under this repo's strict settings. Each was fixed the same way, checking the raw path again immediately before use, never a cast, never a non-null assertion. Worth remembering before copying this plan's code again.

**Open:**
- Nick's review of the fifteen contract files: their judgments (`purpose`, `accent`, `night.recipe`, `options[].intent`, `antiPatterns`) are drafted from the specs, the archetype study and the board notes; they are proposals until he reads each one.
- Which Analog is right: the black dial with white ticks React draws, or the white dial with black ticks the C file draws. The ledger holds the mismatch either way; nothing here leans toward one.
- StateRing's eventual home, `src/apps/agents/` or alongside RoundList in `src/core/widgets/`. The contract works from either location; moving the file is a separate refactor.

---

## 2026-09-05 · branch claude/project-brainstorming-e32502 · design-system step 3: face and widget contracts, spec written

**Changed:** `docs/superpowers/specs/2026-09-05-face-contracts-design.md` (new, 171 lines). Docs only; nothing built, nothing committed.

**Decisions (Nick):** option 2 of three, judgments plus numbers: a `.meta.json` beside every face and kiosk widget carrying the placement judgments, and for hand-and-tick faces the numbers the face is drawn from; the TSX reads its numbers from the file; a parity test diffs the LVGL C constants against the Analog spec; an emitted index and one AGENTS.md rule make the files the first read. Analog and Minimalismo migrate first, the rest on shrink-only lists. Admin surface contracts wait for the Admin IA v2 branch.

**Found while framing:** `slow-native/src/clock_face.c` on main is the Swiss-railway Analog face (ticks, dot, white face, no night palette), not Minimalismo; PR #22 (LVGL night palette) is closed unmerged; React Analog draws a black face with white ticks. AGENTS.md's "currently Minimalismo" is doc drift. The parity gate in the spec is what pins this; which Analog is right is Nick's call, ledgered until made.

**Plan:** spec approved by Nick as written; `docs/superpowers/plans/2026-09-05-face-contracts.md` (new, 8 tasks, TDD, every file's code inline) is the executable form. Task order: schema and helpers; the contract gate plus all 15 meta files (R16); Analog draws from its spec; Minimalismo likewise; the LVGL parity parser, drift ledger and gate (R10 flips to checked); the emitted index with drift gate (R17); the scaffolder meta stub; AGENTS.md rule and this log.

**Open:** execution not started; commits are Nick's call; the 15 judgment drafts inside the plan are proposals until Nick reads them.

---

## 2026-09-05 · branch claude/project-brainstorming-e32502 · design-system step 1: token liveness gate + rule catalog

Approved by Nick as the first of three moves (1 gates, then 3 usage contracts as the face-spec brainstorm, then 2 token axes). Built test-first; nothing committed at the time of writing.

**Changed:**
- `scripts/lib/token-liveness.mjs` (new): fs-free predicates (`declaredTokens`, `stripDeclarations`, `readerPattern`, `findReaders`, `auditLiveness`) and `UNCONSUMED_LEDGER`, a shrink-only list of tokens declared on purpose but read by nothing, 7 entries with reasons. `scripts/lib/token-liveness.d.mts` (new): types so `src/` can import the `.mjs` under strict tsconfig. `scripts/lib/token-liveness.test.ts` (new): 15 fixture tests.
- `src/shared/token-liveness.test.ts` (new): the real-tree gate. Every token declared in `src/index.css` and `src/admin/index.css` has a reader somewhere in `src/` or a ledger entry; a ledger entry whose token gained a reader, or is no longer declared, fails as stale. Same shape as `registry-contract.test.ts`.
- `scripts/lib/rules.mjs` (new): the rule catalog, R01 to R15, one record per rule with `statement`, `why`, and either `checkedBy` (8 rules: npm script or vitest file) or `unchecked` (7 rules: what would check it, who enforces it meanwhile). `scripts/lib/rules.test.ts` (new): 8 meta-tests; a `checkedBy` that names no real script or test file fails.
- `scripts/check-tokens.mjs`: prints the ledger count and the unchecked rules at the end of every run, on failure too.
- `AGENTS.md`: Known gaps opens with the catalog and ledger pointer; the review-enforced bullet carries its rule ids (R09, R10).

**Verified:** `./scripts/gates.sh` green end to end: lint, check:tokens (47 semantic-zone files, 13 faces, 7 ledgered tokens, 7 unchecked rules printed), 446 tests across 36 files, both-SPA build. Each test was watched red before its implementation: module missing first, then the real-tree gate red on exactly the 7 dead tokens the audit below had found. Mutation-checked with every file restored afterward: a phantom `checkedBy` path fails `rules.test.ts` naming the path; a new dead `--color-orphan` in `src/index.css` fails the tree gate naming the token; a ledger entry for a token that has a reader fails as stale.

**Decisions:**
- The 7 dead tokens are ledgered, not deleted, so nothing changes on glass and the list shrinks under step 2: `--color-temp-high`, `--color-temp-low` (WeatherApp never adopted them; wire or delete is a weather design call), admin `--accent`, `--accent-foreground`, `--input`, `--popover-foreground`, `--radius` (unreachable while `src/admin/index.css` has no `@theme inline` block).
- What counts as a reader: the token inside parentheses anywhere in `src/` (covers `var(--x)` and Tailwind's `bg-(--x)`, which Quote, Depletion and Daylight use), plus for kiosk `@theme` names the utility Tailwind derives (`bg-accent`, `font-family-display`). CSS declaration lines never count, tests never count, reads inside comments do count (known, under-reports rather than trusting a comment stripper).
- Left out on purpose: meta-claim checks (no meta files until step 3), a `tokens.ts` name contract (no design-tool sync here), the ds-architecture config file.

**Found:** `src/apps/breathing/BreathingApp.tsx:79` uses `font-display`, which Tailwind v4 does not derive from `--font-family-display` (that name yields `font-family-display`), so the class is a no-op today, hidden because `body` already sets Inter. Fix when Breathing is next touched.

**Open:** commit is Nick's call. Next is step 3, usage contracts (a `.meta.json` per widget, admin surface and face, a routing index, a shipped skill doc), which doubles as the face-spec-as-data brainstorm; step 2 (token axes) after the admin IA v2 branch is merged locally.

---

## 2026-09-05 · branch claude/project-brainstorming-e32502 · orientation + design-system audit

**Changed:** `docs/agent-log.md` (this file, new), `AGENTS.md` (one-line pointer to this log). No source changes. Nothing committed at the time of writing.

**Verified:** docs only, so no gates were run. Fleet state below was read live from `/api/health` and `tailscale status`; token numbers come from greps over `src/`, listed so the next session can re-run them.

**Fleet state (read 2026-09-05):**
- fastclock: reachable (LAN 192.168.4.30, tailnet 100.78.29.28). Running branch build `34af264` (`claude/verifiable-deploys`, built 2026-08-08), 67 commits behind `main` (`77f742a`), up 29 days. Kiosk shows Minimalismo.
- squareclock: reachable (LAN 192.168.4.44). `/api/health` has no build stamp, so it runs a build older than the stamp work; commit unknown.
- smallclock: tailnet says offline 5 days. slowclock: offline 88 days.
- Every `superclock-*/device.json` IP is stale (fast says .28, square says .22); small and slow are TBD stubs. `CLOCK_SPECS.txt` disagrees with them. Neither file is read by code.
- Local dev port 5180 was held by another project's Vite server (pegbo-proto-starter, PID 79318, up 3 days). `npm run dev` here cannot bind until that is stopped or the launch config uses another port.

**Repo state:** `main` equals `origin/main` at `77f742a`. Open PRs at the time: #52 (Admin IA v2 P1, 45 files, mergeable, blocked only on an on-glass check) and #53 (RoundList + Todo component tests, mergeable). CI green on main 13 days earlier. Both are branches to merge locally if wanted; see the no-PR rule above.

**Open defects from `docs/decisions/2026-07-24-concept-adjudications.md`, re-checked:**
- Single-app swipe wedge: fixed and pinned (`src/core/navigation.test.ts:68`).
- `settings.presence` still absent from the strict schema in `src/shared/device-config-schema.ts` while `src/shared/types.ts:91` declares it and `PresenceShade.tsx` + `server/display-adapter.ts` read it. Likely still breaks the settings PATCH once a device carries the key; not re-tested.
- `noteUserGesture` is now called only from `src/core/components/QuickSettings.tsx`. Calendar paging and face cycling still do not stamp it, so playlist rotation can still interrupt them.
- 3-finger pointer set in `src/core/hooks/useGestures.ts` still has no reset on `blur` or `visibilitychange`.
- `README.md` lists 10 apps (14 registered) and still documents `VITE_GITHUB_TOKEN` (token moved server-side).

**Design-system audit (kiosk `src/index.css`, admin `src/admin/index.css`):**
- Kiosk declares 13 custom properties. Zero readers anywhere in `src/` (no `var()`, no utility): `--color-temp-high`, `--color-temp-low`. Live: `--color-accent` (8 `var()` reads), `--face-ink` (15), `--face-ink-muted` (5), `--face-bg`, `--face-tick`, `--face-plate`, `--face-dusk` (2 each), `--face-spent`, `--face-ghost` (1 each), `--color-sheet` (1, via `bg-sheet`), `--font-family-display` (body rule + 1 utility).
- Admin declares 23. Zero `var()` reads in `src/admin`: `--accent`, `--accent-foreground`, `--input`, `--popover-foreground`, `--radius`. `--foreground` is read only by the `.admin-root` rule itself. There is no `@theme` or `@theme inline` block, so shadcn utilities such as `hover:bg-accent`, `border-input`, `rounded-lg` cannot resolve to these tokens; that is why they are dead. Admin border-color utilities are dead for a second reason already recorded in AGENTS.md (unlayered reset).
- Motion: no motion tokens. Inline framer literals in 3 kiosk files (`duration: 0.8`, `0.3`, `0`, `ease: 'easeInOut'`). No `prefers-reduced-motion` handling anywhere.
- Admin raw Tailwind steps (grep counts over `src/admin/**/*.tsx`): 137 spacing, 43 radius, 4 shadow, 10 pinned control heights (`h-8`…`h-12`). No spacing, elevation or radius roles.
- Component usage contracts: none. No `.meta.json`, no routing index, no shipped skill doc. `src/core/widgets/` holds one widget (`RoundList.tsx`).
- The `ds-architecture` conformance ladder (`/Users/nickv/ClaudeCode Projects/ds-architecture`, `node scripts/conformance.mjs <repo>`) exits "could not tell" on this repo: it needs a `ds-architecture.config.json` at the repo root (profile, adoption, scopeRoles, paths, axes, commands). Not written, pending the decision below.

**Newer design-system moves not yet absorbed here** (from design-system-rebuild through 2026-09-05 and ds-architecture 2026-08-22; PR #51 on 2026-08-14 already ported the token gate, scaffolders, contract gate, gates.sh, hooks and unslop):
1. Token liveness walk: declaration, then alias, then a component that reads it; a declared `unchecked` ledger for rules no script can run; rule and detector as one record.
2. Token axes: three-tier globals with an `@theme inline` block for the admin, a device axis for the kiosk (round 1080, round 800, square 800x480), motion tokens with reduced-motion, spacing and elevation roles instead of raw steps.
3. Usage contracts: a `.meta.json` per widget, admin surface and face (variant intent, state recipes, anti-patterns with the why), a routing index, a shipped skill doc. For faces this is the pending face-spec-as-data brainstorm.

**Decisions taken this session:**
- Work lands as local code changes, no PRs (Nick, 2026-09-05).
- This log exists; shape approved by Nick (path, entry fields, per-chunk cadence).

**Open:** Nick has not yet picked which move goes first (1 gates, 2 token axes, 3 usage contracts, or all in ladder order). Recorded recommendation: 1 now, then 3 as the face-spec brainstorm, 2 after the admin IA v2 branch is merged locally so it does not conflict with those 45 files. Fleet redeploy to `main` is a separate, unpicked item.

---

## Entries below merged from AGENT-LOG.md on 2026-09-06

These twelve entries were written to a second log file, `AGENT-LOG.md`, by sessions on branch `claude/agentic-design-system-arch-ac2da8`. The 2026-09-06 merge that left two rule catalogues coexisting left two agent logs the same way, and AGENTS.md named both, so a handoff written to one was invisible to an agent reading the other. They are moved here verbatim, newest first as they were, and `AGENT-LOG.md` is deleted. No entry's text was changed: this log's own rule is that an older entry is never rewritten.

---

## 2026-09-05 · item 6: path-scoped rules split (.claude/rules/)

- **What:** three path-specific bodies moved out of the always-loaded AGENTS.md into
  `.claude/rules/*.md` with `paths:` frontmatter, which Claude Code loads only when a matching
  file is read: `gestures-and-navigation.md` (`src/core/**`, app components — arc map, the
  `mode: 'transitioning'` invariant, the guarded cleanup), `clock-faces.md` (`src/apps/clock/**`,
  `face.*` schemas, `slow-native/src/*` — useClockHands, the `--face-*` night contract, schema
  reading, the one-accent rule, LVGL parity), `pi-deployment.md` (`scripts/*.sh`, units, CI —
  what deploy.sh ships, its guards, the systemd naming drift).
- **AGENTS.md still states every rule.** Each moved section leaves a one-line summary naming its
  rule file, so agents that do not read `.claude/rules/` (Codex and friends read AGENTS.md) learn
  the rule exists and where the body is. AGENTS.md 20057 → 14550 bytes; the bodies are 10474
  bytes that now load only when relevant.
- **Gate:** `scripts/lib/rules-scoped.test.ts` (20 checks) — every rule has `paths` and a
  `summary`; every glob matches at least one tracked file (a typo'd glob is worse than a missing
  rule: it never loads and nothing says so); every rule is named from AGENTS.md; every rule's
  summary appears there verbatim; every `.claude/rules/…` path AGENTS.md names is a real rule.
- **Drift gate widened, and it caught the split itself:** moving names out of AGENTS.md made its
  NOT_IN_TREE and MUST_NOT_EXIST rows stale and dropped the identifier count below the floor.
  The right fix was scope, not exemptions: the instruction corpus is AGENTS.md PLUS
  `.claude/rules/*.md` (one contract split by scope), and the rule files are excluded from the
  CODE corpus so a name mentioned only in prose still does not count as used. 117 → 127 checks.
- **Also fixed:** the stubs first landed carrying their literal YAML quotes — the parser now
  strips a quote pair (the gestures summary must be quoted because it contains `mode: '`).
- **Verified:** gate red on the missing directory, then red on the missing stubs, green after;
  drift gate red on the stale ledgers, green after widening; gates.sh green: lint, check:tokens,
  45 files / 708 tests, build.
- **Open:** none for item 6. All six items from the 2026-09-05 plan are done.

---

## 2026-09-05 · item 5: regenerable health report (docs/health.md)

- **What:** `npm run report` renders `docs/health.md` from the registries, the ledgers and the
  rule catalogue: 14 apps with capabilities, config schema and whether it is read; 13 faces with
  night-token state; all 27 schemas plus the SCHEMA_UNREAD ledger; the 25 rules with their method
  and severity counts, the live tree scan, the BASELINE, the unchecked and delegated lists and
  every sanctioned exemption with its reason; the 4 devices with features and hardware flags.
  It asserts nothing — the gates do that — and the committed copy is held to a fresh render by
  `npm test`, so nobody reads a stale map.
- **Refactors it forced (both good):** the schema-liveness ledger and predicate moved out of the
  test into `src/shared/schema-liveness.ts`, and the rule BASELINE into
  `scripts/lib/rule-baseline.mjs`, so the report and the gates read one implementation each
  instead of the report re-deriving them.
- **Changed:** `scripts/lib/health-report.ts` + `.test.ts` (new), `src/shared/schema-liveness.ts`
  (new), `scripts/lib/rule-baseline.mjs` (new), `schema-liveness.test.ts` and
  `rulecheck-tree.test.ts` (import the shared modules), `package.json` (`report` script),
  `AGENTS.md` (command + a Conventions bullet), `docs/health.md` (generated).
- **Verified:** gate red on the missing module, then red again for naming FACE_TOKEN_EXEMPT only
  implicitly (the fix names the ledger and its shrink-only contract in the report, which is the
  more useful output); determinism asserted by rendering twice; a hand-edited copy fails and a
  regenerated one passes. gates.sh green: lint, check:tokens, 44 files / 679 tests, build.
- **What the first report shows:** every schema read (27/27), both ledgers empty, 0 rule
  violations over 165 files, 7 rules permanently unchecked (4 judgment, 3 rendered), 3 delegated,
  8 sanctioned exemptions, and the fleet's hardware split (audio and radar on fast only).
- **Open:** none for item 5.

---

## 2026-09-05 · item 4: docs drift gate + the stale entry docs

- **What:** `scripts/lib/docs-drift.test.ts` (117 checks) holds the claims AGENTS.md and the entry
  docs make about the tree to the tree: every backticked repo path exists (brace-expanded,
  basename search for bare filenames), every backticked identifier appears in the code roots,
  every `--token` prefix is declared in a stylesheet, every rule id is in `rules/*.json`, every
  `npm run` script is in package.json; README's app list and the "N apps registered" counts in
  `directive/foundation.md` and `docs/architecture.md` match the registry parsed from
  `src/apps/index.ts`. It catches stale names and counts, never wrong advice.
- **Ledgers:** `NOT_IN_TREE` (dist/, server.mjs, build-info.json, .env, superclock.service,
  config/fleet.json, config/admin.json) with reasons, checked two-way against `git ls-files` (a
  name that becomes tracked must leave); `MUST_NOT_EXIST_IN_CODE` (BackChevron) asserts a
  deletion AGENTS.md relies on stays deleted.
- **Docs fixed (the gate's first red):** README app list 10 → 14 with registry descriptions,
  `VITE_GITHUB_TOKEN` row replaced by the server-side `GITHUB_TOKEN` (docs-site gap 08, open since
  July), "falls back to mock" wording removed, scripts block gains test + gates.sh, pointer to
  AGENTS.md; foundation.md and architecture.md 11 → 14 apps; AGENTS.md's hand-kept "Users:" list
  of swipe registrants (7 of 10, stale) replaced by a pointer to the `multiView` declarations the
  capability contract already holds to the code.
- **Gate bugs found on the first run:** dist/ exists on a developer disk after a build, so
  "in the tree" now means tracked by git; the gate was reading its own ledger as code (excluded).
- **Verified:** red on exactly the four stale docs plus the two gate bugs; green after.
  43 files / 673 tests, lint, tsc.
- **Open:** none for item 4.

---

## 2026-09-05 · item 3: app capability contract + device hardware flags

- **What:** structured metadata that is checked, never trusted. `src/shared/app-capabilities.ts`
  declares per app what it does (`fetches`, `ticks`, `multiView`) and needs (`audio`, `mic`,
  `radar`); `app-capabilities.test.ts` (54 checks) holds every row to the code: fetches ⇔ the
  directory calls fetch() and carries an honest tell, ticks ⇔ it owns a timer/rAF, multiView ⇔ it
  registers the swipe slot; every hardware need is a `FeatureFlag` some device provides; the wire
  descriptor carries the list. Declarations were derived from a grep table, not guessed:
  agents mic (voice design, mock today), breathing radar, fitness audio (circuit cues),
  time-tracking radar (presence), every fetching app has its tell.
- **Device flags:** `FeatureFlag` gains `audio` | `mic` | `radar`; `capabilities.ts` declares
  them from fleet.md and device.json (fast: Fusion HAT mic + speaker, hosts the A121; small and
  square: USB mic; slow: none). Admin Settings reads flags by name, so the new ones are inert
  there. `AppDescriptor.capabilities` is optional on the wire (LVGL JSON stays valid).
  `devicesProviding(flag)` lives in capabilities.ts (app-capabilities.ts is a leaf on purpose:
  importing capabilities.ts back would be a module cycle).
- **Scaffolder:** `new:app` now inserts an empty `'<id>': [] // SCAFFOLD-TODO` row
  (`insertAppCapabilities`, pinned in scaffold-templates.test.ts); the contract test then holds
  the row to the code as the app is implemented.
- **Changed:** `src/shared/types.ts`, `app-capabilities.ts` (new), `app-capabilities.test.ts`
  (new), `capabilities.ts`, `scripts/lib/scaffold-templates.mjs`, `scaffold-templates.test.ts`,
  `scripts/new-app.mjs`, `AGENTS.md` (adding-an-app list + Conventions bullet).
- **Verified:** contract red on the missing module, green first run (facts matched the table);
  scaffold test red on the missing insertion, green after; scaffold smoke `new:app cap-smoke`
  passed contract + coherence + registry-contract + liveness with only the by-design todo test
  red, tsc clean, smoke removed surgically (git checkout would have wiped the uncommitted
  capabilities.ts edits: reverted by line instead). 42 files / 556 tests, tsc, lint green.
- **Decisions to flag, not taken:** whether a device without `mic` should stop OFFERING Agents
  (supportedAppIds), and whether the kiosk should show "no mic on this device" tells; both are
  product calls now backed by data. Radar is declared on fast only (the sidecar runs there).
- **Open:** none for item 3.

---

## 2026-09-05 · item 2, batch d: the last three apps wired (Claude usage, Fireplace, GitHub) — SCHEMA_UNREAD is empty

- **What:** item 2 complete. Every declared schema (27) is value-imported by its component; the
  ledger is empty and AGENTS.md says so.
- **Claude usage:** `refreshSeconds` drives the poll (default aligned 60 → 30, the historical
  interval); `moodEnabled=false` leaves the metrics without the sprite and stops its rotation
  tick. `scope` cannot be honoured (the daemon reports one rollup), so it is the first user of
  a new `FieldMeta.unimplemented` note: the admin renders the control disabled with
  "Not applied on the glass yet: …" (string, number, enum, boolean branches of schema-form;
  never hidden, never silently broken).
- **Fireplace:** `src/apps/fireplace/fire-params.ts` (pure, 11 tests): `spawnPerFrame`
  (calm 1 / medium 3 / roaring 6), `flameColor` (classic reproduces the original gradient
  verbatim; cool/blue/purple are a first cut to tune on glass), `emberColor`. The effect
  restarts on a config push.
- **GitHub:** `src/apps/github/github-config.ts` (pure, 9 tests): `paletteFor` (default = the
  historical greens; monochrome greys; accent ramps into `var(--color-accent)` via color-mix),
  `cacheKeyFor` (blank keeps the historical key so an existing cache still seeds the boot
  paint; a username gets its own key), `contributionsUrl`. The app is now `GithubApp` (parses
  config) → `GithubGraph` keyed on the cache key, so a username change remounts with that
  user's cache instead of briefly painting another user's graph; sub-views take `colors`;
  `refreshMinutes` drives the interval (default 30 = historical). `server/github-proxy.ts`:
  `?username=` switches the GraphQL subject from viewer to `user(login:)`, validated by
  `isValidLogin` before interpolation (400 otherwise), cache and single-flight per login
  (`server/github-proxy.test.ts`, 4 tests).
- **Changed:** the files above plus `src/shared/types.ts` (FieldMeta.unimplemented),
  `src/admin/lib/schema-form.tsx`, `app.claude-usage.ts`, `schema-liveness.test.ts` (3 → 0).
- **Verified:** gate red on exactly the three; pure suites red on missing modules/exports, green
  after. 41 files / 501 tests, tsc, lint, check:tokens green; check:rules 0 violations.
  Dev preview (5181): Fireplace canvas mounted; GitHub honest empty state ("set GITHUB_TOKEN on
  the server") painting 364 level-0 dots from the palette; Claude usage metrics + sprite +
  "auth expired" tell. Console carried 17 stale HMR errors from mid-edit churn (Invalid hook
  call while modules were half-updated); a reload added none. Not exercised in the browser:
  the disabled `scope` control in the admin form (needs an instance; the change is JSX only),
  the non-default hues/intensity/palettes, a non-blank username against real GitHub.
- **Open:** none for item 2. Follow-ups noted, not started: tune the cool/blue/purple flames on
  glass; the seven legacy faces still on FACE_TOKEN_EXEMPT (night tokens, a separate retrofit).

---

## 2026-09-05 · item 2, batch c: three faces with behaviour wired (Productivity, Flip, World)

- **What:** the last three legacy face schemas. Defaults aligned to today's rendering:
  `face.productivity` accent #ffcc00 → #ff8826 (date, second hand, hub), `face.flip` accent
  #f97316 → #ffffff (the digits have always been white), `face.world` accent #3b82f6 → #ee0000
  (the primary dial's second hand and hub ring). New behaviour only when configured:
  Productivity `showSeconds=false` hides the second hand; Flip `hour24=false` renders 12-hour
  digits (two digits kept so the panel width never jumps) plus an AM/PM label in the accent
  colour; World `primaryTimezone` drives the primary dial's hour and minute hands through
  `src/apps/clock/world-time.ts` (pure: resolveTimezone, timeInTimezone, handDegreesInTimezone;
  same formulas as useClockHands). An IANA name Intl rejects degrades to the device clock
  instead of throwing at render. The mini dials now share the same formatter cache.
- **Changed:** `ProductivityClock.tsx`, `FlipClock.tsx`, `WorldClock.tsx`, new `world-time.ts`
  + `world-time.test.ts` (7 cases), the three schemas, `schema-liveness.test.ts` (ledger 6 → 3;
  every face schema is now read). The seven legacy faces remain on FACE_TOKEN_EXEMPT.
- **Verified:** liveness gate red on exactly the three and world-time red on the missing module,
  both green after; 38 files / 479 tests, tsc, lint, check:tokens green. Dev preview face cycle:
  Flip renders white digits, World its red second hand, Productivity its orange, no console
  errors. Not exercised on-glass: the non-default paths (12-hour Flip, a non-local primary
  timezone), which are covered by the pure tests and by construction.
- **Open:** ledger rows for claude-usage, fireplace, github (batch d).

---

## 2026-09-05 · item 2, batch b: four accent-only faces wired (Square, Floral, Complications Light, Complications Dark)

- **What:** each face now takes `FaceProps`, parses `faceConfig` against its schema with the
  defaults as fallback (AnalogClock pattern), and draws its accent from the parsed value.
- **Defaults aligned to what the face has always drawn**, so an unconfigured instance is
  pixel-identical: `face.square` #22c55e → #e94560 (sub-dial ring + hub), `face.floral`
  #f59e0b → #fbbf24 (hands). Complications Light/Dark already defaulted to their habit-ring
  green #22c55e; only the green is bound to `accent` (the amber weather sub-dial, the light
  face's amber second hand and the dark face's purple second hand are separate decisions and
  stay literal). A saved instance that stored the OLD default will now render that stored
  colour, which is what the admin has been displaying for it all along.
- **Changed:** `SquareClock.tsx`, `FloralClock.tsx`, `ComplicationsLight.tsx`,
  `ComplicationsDark.tsx`, `face.square.ts`, `face.floral.ts`, `schema-liveness.test.ts`
  (ledger 10 → 6). These four stay on FACE_TOKEN_EXEMPT: night tokens are a separate retrofit.
- **Verified:** gate red on exactly the four, green after; 37 files / 472 tests, tsc, lint,
  check:tokens green. Dev preview (5181): cycled the clock faces via the registered swipe
  callback; Complications Dark, Complications Light, Floral and Square each rendered with their
  default accent present in the DOM; no console errors.
- **Open:** ledger rows for productivity, world, flip (batch c) and claude-usage, fireplace,
  github (batch d).

---

## 2026-09-05 · item 2, batch a: four schemas wired (Agents, Breathing, Date, Temperature)

- **What:** the four mechanical rows of SCHEMA_UNREAD. Each component now value-imports its
  schema and reads config through `schema.safeParse(config ?? {})` with the schema defaults as
  the fallback (the Calendar pattern, decision D4). Behaviour unchanged for valid config;
  malformed config now yields the defaults instead of partially-filtered raw fields.
- **Changed:** `src/apps/agents/AgentsApp.tsx` (enabledAgents / defaultAgent via
  `agentsAppSchema`), `src/apps/breathing/BreathingApp.tsx` (showDistance via
  `breathingAppSchema`, the raw `as Partial<T>` cast is gone),
  `src/shared/complications/Date.tsx` and `Temperature.tsx` (mixed value+type imports,
  safeParse). `schema-liveness.test.ts`: ledger 14 → 10.
- **Verified:** ledger rows removed first, gate red naming exactly the four; green after the
  wiring. 37 files / 472 tests, tsc -b, lint green.
- **Open:** ledger rows for 7 legacy faces + claude-usage, fireplace, github (batches b to d).

---

## 2026-09-05 · item 1: baseline debt paid, NAV-1 promoted to blocker (branch `claude/agentic-design-system-arch-ac2da8`)

- **What:** the five BASELINE rows from option 2 are fixed and deleted; the baseline is empty
  and documented as the steady state. NAV-1 is now a `blocker`.
- **Changed:** `AgentsApp.tsx` and `WeatherApp.tsx` adopt HabitsApp's exact shape (inactive
  branch nulls, captured `cb`, cleanup nulls only if the slot is still ours).
  `src/admin/lib/array-fields.tsx`: the list-editor input gains
  `focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]` (neither the input nor its row
  had any focus treatment). `TodoApp.tsx`: `border-[3px]` becomes Tailwind v4's `border-3`
  (compiles to the same 3px, verified in both built CSS bundles). `src/admin/routes/Apps.tsx`:
  the instance-count pill snaps from `text-[10px]` to `text-xs` (12px; the only visual change,
  admin-only). `rules/superclock.json`: NAV-1 severity blocker, provenance note.
  `rulecheck-tree.test.ts`: BASELINE = {}. `AGENTS.md` Known-gaps bullet rewritten.
  `.claude/launch.json`: new `dev-alt` config on 5181 so a worktree can preview while another
  session holds 5180 (5180 was held by a vite for pegbo-proto-starter, left running).
- **Verified:** tree gate red with exactly the five rows after emptying the baseline, green after
  the fixes; gates.sh green (lint, check:tokens, 37 files / 472 tests, build). Dev preview on
  5181: Weather → Habits → Weather → Todo via `window.__nav` + `finishTransition()`, the
  swipe slot stayed registered after every transition, mode returned to `app`, no console errors.
  Not exercised: Agents' per-agent view registration (needs an in-app tap; same shape as
  Weather), the Todo row (list empty in dev, covered by the CSS check), keyboard focus on the
  admin input (hidden tab cannot deliver keyboard focus).
- **Open:** none for this item.

---

## 2026-09-05 · option 2: rule catalogue + runner (branch `claude/agentic-design-system-arch-ac2da8`)

- **What:** every design rule is one record with its severity and its detector, in
  `rules/superclock.json` (25 rules: 7 grep, 5 heuristic, 3 requires, 4 judgment, 3 rendered,
  3 delegated; 19 blocker / 4 review / 2 warning; 8 exemptions, each with a reason). Judgment
  and rendered rules print as unchecked on every run instead of silently passing (one-accent
  FCE-1, LVGL parity FCE-2, honest offline CPY-4, states STA-1, contrast STA-5, 375px STA-7,
  circle crop KIO-2); delegated rules name the gate that enforces them (SYS-1 and FCE-3 the
  token gate, KIO-3 the ESLint clock setInterval ban).
- **Changed:** `scripts/rulecheck.mjs` (harvested from design-system-rebuild, stdlib only,
  comment-stripping; three pinned extensions: `requires` co-occurrence, exemptions as
  { path, reason }, `delegated`; single-file mode prints findings only). `scripts/lib/rule-schema.mjs`
  (zod, ported from the ds-architecture starter kit). Tests: `rulecheck.test.ts` (engine
  claims + CLI), `rule-catalogue.test.ts` (schema, compile, fix, exemption reasons, every
  mechanical rule fires on `<id>-bad.tsx` and stays quiet on `<id>-good.tsx`),
  `rulecheck-tree.test.ts` (policy: zero tolerance off the baseline, two-way baseline).
  33 fixtures under `scripts/lib/__fixtures__/rules/`. `npm run check:rules`. Hook
  `.claude/hooks/check-tokens-on-edit.sh` also runs blocker rules on the edited file
  (advisory). `AGENTS.md`: command, Conventions bullet, Known gaps rewritten (two bullets
  replaced), Gestures pointer, one new trap. `unslop/SKILL.md` Phase 2 points at check:rules.
- **Tree at freeze:** 0 blockers; baseline debt NAV-1 x2 (AgentsApp, WeatherApp: unconditional
  null of the shared slot), STA-3 x1 (array-fields.tsx:262), LAY-4 x2 (TodoApp border-[3px],
  Apps.tsx text-[10px]). Sanctioned exemptions: COL-4 QuickSettings sheet + admin sticky
  header; MOT-1 SwipeContainer Suspense spinner + breathing/fireplace/clock ambient carve-out;
  LAY-4 vendored shadcn ui/; KIO-1 useCalendarEvents (gated through `enabled`).
- **Verified:** `./scripts/gates.sh` green: lint, check:tokens, 37 files / 472 tests, build.
  Engine claims red before the runner existed (missing module), green after; the CLI footer
  test was red before the suppression, green after. Hook pipe-tested: blocker probe prints the
  finding, a review-only file stays silent, an ungated file stays silent, exit 0 throughout.
- **Found along the way:** `useCalendarEvents.ts` mentions isActive only in a doc comment
  while gating through `enabled`; a raw grep read it as gated, the comment-stripping runner
  did not. Recorded as a KIO-1 exemption and a trap in AGENTS.md.
- **Decisions:** ci.yml and gates.sh unchanged on purpose: the CLI exits 1 on any hit
  (baseline debt included), so policy lives in `npm test`. Severity is earned: NAV-1 ships at
  review and is promoted to blocker when Agents and Weather adopt the HabitsApp guard.
- **Open:** the five baseline rows (each a small app or admin change with its own review);
  options 3 to 7 from the gap analysis, awaiting Nick.

---

## 2026-09-05 · option 1: schema-liveness gate (branch `claude/agentic-design-system-arch-ac2da8`)

- **What:** the consumption half of the registry contract. `src/shared/schema-liveness.test.ts`
  requires every declared app/face/complication schema to be value-imported by the component
  that owns it (Calendar pattern, `schema.safeParse(config ?? {})`), or to sit on
  `SCHEMA_UNREAD`, a shrink-only ledger with a reason per row. Two-way: a row whose schema
  became read fails as stale. `import type` does not count.
- **Changed:** new `src/shared/schema-liveness.test.ts` (ledger frozen at 14 of 27: apps
  agents, breathing, claude-usage, fireplace, github; faces productivity, square, floral,
  complications-light, complications-dark, world, flip; complications date, temperature).
  `scripts/lib/scaffold-templates.mjs`: app and face templates now import and safeParse their
  schema (born schema-live); `scaffold-templates.test.ts` pins it. `AGENTS.md`: gate
  described next to coherence/contract, scaffolder lines updated.
- **Verified:** empty ledger went red on the real tree naming the 12 app/face schemas; the
  widened gate adds the 2 complication renderers (type-only imports, mounted nowhere, D2).
  A temporary copy with a stale `app.calendar` row failed on exactly the stale-row test.
  Scaffold smoke (`new:app` + `new:face liveness-smoke`): tsc, lint, check:tokens green;
  the only red tests were the two by-design todo tests and the missing preview art; reverted.
  Clean tree: 34 files / 429 tests, lint, check:tokens green.
- **Decisions:** predicate is a value import (not safeParse presence): honest floor, stated in
  the file header. Complications included rather than declared out of scope, since renderers
  exist. Ledger rows carry the fix direction (Calendar / AnalogClock reference).
- **Open:** the 14 rows themselves (wiring work, each its own change); option 2 next.

---

## 2026-09-05 · agentic design-system gap analysis (branch `claude/agentic-design-system-arch-ac2da8`)

- **What:** brainstorm-only session. Read the six Design Systems Collective "agentic design
  system" articles (AI-ready DS, agentic DS, structured metadata, codebase index,
  orchestration, encoding governance) and mapped them onto this repo, the July decisions
  record, PR #51/#52, and the sibling repos `design-system-rebuild`, `ds-architecture`,
  `Minimal Design System`.
- **Changed:** no code. Created this file and one pointer line in `AGENTS.md`. Findings also
  in the private memory `agentic_ds_gap_analysis.md`.
- **Verified against the tree (77f742a):**
  - 11 of 25 declared schemas are never read by their component: apps `agents` (raw fields,
    no schema), `claude-usage`, `fireplace`, `github`; faces `productivity`, `square`,
    `floral`, `complications-light`, `complications-dark`, `world`, `flip`. The admin renders
    forms for all of them.
  - 10 apps register `setVerticalSwipeCallback`; `AgentsApp` and `WeatherApp` use an
    unconditional `setVerticalSwipeCallback(null)` instead of the guarded shape AGENTS.md
    mandates. Whether it stomps in practice depends on effect order; not reproduced.
    AGENTS.md's "Users:" list names 7 of the 10.
  - Prose drift: `directive/foundation.md` and `docs/architecture.md` say 11 apps (code: 14);
    `README.md` still documents `VITE_GITHUB_TOKEN` with a mock fallback.
  - False positives worth remembering for any detector: `fitness/useCircuitTimer.ts` IS gated
    (via its `active` param); Claude-usage's offline tell lives in the App, not the hook.
- **Conclusion:** the articles' enforcement layer already exists here (token gate, coherence +
  contract tests, scaffolders, hooks, gates.sh, unslop). Missing are the consumption check
  (is a declared contract read?) and a regenerable report. A TOON index or `.metadata.ts`
  sidecars are not worth it at 14 apps / 13 faces: the registries are the index.
- **Options presented to Nick (awaiting pick):** 1 schema-consumption liveness gate;
  2 rule catalogue + stdlib runner (port `design-system-rebuild` `rules/` + `rulecheck.mjs`);
  3 capability contract on `AppMetadata` (adds missing audio/mic/radar FeatureFlags);
  4 AGENTS.md drift gate; 5 regenerable health report; 6 path-scoped rules split;
  7 deliberately skip index/instance-count/sidecar metadata. Recommended 1 then 2.
- **Open:** Nick's pick. Each pick gets its own brainstorm classification before any code.
