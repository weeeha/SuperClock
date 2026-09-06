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

The `slow` device renders faces natively (LVGL, C — `slow-native/`, PRs #23/#24). Any face that exists on both sides (currently Minimalismo) has **two implementations kept in sync by hand**: if you change a shared face's geometry, palette, or night behavior in React, update `slow-native/src/clock_face.c` in the same PR or file a follow-up. Longer term the intent is a shared JSON face-spec (colors, hand geometry, tick layout — the same data `face.*` schemas and `handPoints` already encode) consumed by both renderers; until that exists, treat visual parity as part of face-change review (`FCE-2`, also `judgment`).
