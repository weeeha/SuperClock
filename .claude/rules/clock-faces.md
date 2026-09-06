---
paths:
  - "src/apps/clock/**/*.{ts,tsx}"
  - "src/shared/schemas/face.*.ts"
  - "slow-native/src/*.{c,h}"
summary: "**Clock faces** — the hand-angle source of truth, the `--face-*` night contract, the one-accent rule and React ↔ LVGL parity live in `.claude/rules/clock-faces.md` (loaded automatically when you touch a face). Gated as `FCE-1`/`FCE-2`/`FCE-3` and `KIO-3` in `rules/superclock.json`."
---

# Clock faces

Loaded when you touch a face component, a `face.*` schema, or the native LVGL
renderer. The one-line rule lives in AGENTS.md; this is the body.

## Hands tick in one place

`useClockHands` is the single source of truth for hand angles; ESLint bans `setInterval` in `src/apps/clock/` (`KIO-3`). A copy-pasted face that rolls its own timer — and its own inline `seconds * 6` — regresses the second-hand wrap fix, so it fails lint instead.

## Night is a token flip

Night mode is a `--face-*` palette flip in `src/index.css`, never per-face logic: a face that hardcodes its colours silently ignores night. `npm run check:tokens` reconciles the face list from `face-components.ts`'s real imports and holds every face to it (`FCE-3`). Seven legacy faces are exempt via `FACE_TOKEN_EXEMPT` in `scripts/lib/token-rules.mjs`; that list may only shrink — retrofit a face (consume `--face-bg`/`--face-ink` at minimum), then delete its line. Never fork a night variant of a component.

## Face options come through the schema

A face receives `faceConfig` (schema defaults merged under the instance's saved `face` options, assembled in `ClockApp.tsx`) and reads it the way `AnalogClock` does: `schema.safeParse(faceConfig ?? {})` with `schema.parse({})` as the fallback. `src/shared/schema-liveness.test.ts` fails when a declared `face.<id>` schema is never value-imported by its component. A schema default must match what the face already draws, or an unconfigured instance changes appearance the day the schema is wired.

## One accent quantity

The one-accent-quantity rule from the three-faces study (2026-07-24) holds: at most one saturated accent quantity on the dial. It is `FCE-1`, declared `judgment` — every `check:rules` run prints it as unchecked rather than passing it. **Do not quietly change a face's palette or geometry to turn a check green**: the face's look is the product, so a red check on a deliberate design is a conversation, not a fix-forward.

## React ↔ LVGL parity

The `slow` device renders faces natively (LVGL, C — `slow-native/`, PRs #23/#24). The face that exists on both sides is **Analog**: `clock_face.c` is the Swiss-railway face, and AGENTS.md said Minimalismo until 2026-09-06, which is how long the two disagreed unnoticed. Parity is no longer review-only. `src/shared/lvgl-parity.test.ts` parses the C file's `geom_t` initializer and its colour calls and diffs them against the spec block in `src/apps/clock/AnalogClock.meta.json`; a mismatch fails unless `PARITY_DRIFT_LEDGER` (`scripts/lib/lvgl-parity.mjs`, shrink-only) names it with a reason, and an entry that stops mismatching fails as stale. Nine mismatches are ledgered today: the dial colour, the ink, the tick and minute-hand colours, the face radius and all four tick edges. Which renderer is right is Nick's decision, so do not reconcile one side to green the gate. If you change a shared face's geometry, palette or night behaviour in React, change `slow-native/src/clock_face.c` with it. The longer-term intent is still a shared JSON face-spec consumed by both renderers, and each face's `spec` block is its first slice (`FCE-2`, now `delegated`).
