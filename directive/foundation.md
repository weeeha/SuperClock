# SuperClock — Foundation

Project-wide direction. Stable. Reviewed when a major architectural shift is proposed.

For subsystem-specific scope see:
- [docs/architecture.md](../docs/architecture.md) — app catalog, primitive kit, sequencing (working doc)
- [docs/admin/foundation.md](../docs/admin/foundation.md) — admin panel, fleet model, face/complication system
- [docs/admin/plan.md](../docs/admin/plan.md) — admin implementation steps

## What SuperClock is

A smart-clock OS for round-LCD Raspberry Pis. Each Pi runs full-screen as a kiosk. Apps are mini React components on the Chromium-based Pis; the Slow Pi runs a native LVGL binary against the same wire contract. Users navigate by swipe: down for the app grid, left/right between apps; apps can host their own internal navigation.

Today: 4 Pis around the house (Fast, Small, Square, Slow). 11 apps registered. An admin panel manages per-device config. Built by [@weeeha](https://github.com/weeeha), for [@weeeha](https://github.com/weeeha).

## The three horizons

| Horizon | Audience | What it forces |
|---|---|---|
| **1. Personal kiosk** (now) | Author + 4 Pis at home | Polish the apps the author wants; shell stability |
| **2. Open-source codebase** (mid-term) | Other devs cloning the repo | Clean abstractions, primitive kit, docs, contribution model |
| **3. End-user ecosystem** (long-term) | Non-coders running SuperClock at home | Visual customization, community faces/scenes, multi-device social ("converse + share screens at home") |

Decisions are evaluated against all three horizons. A choice that locks horizon 3 out is rejected even when horizon 1 is the only live use case.

## Non-negotiables

1. **Round-screen first.** Layouts assume a 1080×1080 viewport with a circular clip. Rectangular-list UI is allowed but must respect ~22% margin loss at the corners — see `RoundList` primitive in [docs/architecture.md](../docs/architecture.md).
2. **Per-device adaptability.** Hardware varies (Fast/Small/Square/Slow). The Slow Pi runs native LVGL, not Chromium. Capability declarations (`DeviceCapabilities`) drive what each device exposes; no `if (deviceId === 'slow')` branching in JSX. See [docs/admin/foundation.md §Type model](../docs/admin/foundation.md).
3. **Local-first.** Every Pi must be standalone-functional. Last-good config is cached to `localStorage` under `superclock:device-config`. A Pi that boots while the admin host is down still shows its last configured screens.
4. **Touch-only navigation.** No keyboard or mouse. Multi-touch must work — see the labwc `mouseEmulation="no"` fix in `.claude/projects/.../memory/labwc_touch_multitouch.md`.
5. **Apps register; the shell discovers.** New apps are added by an import in [src/apps/index.ts](../src/apps/index.ts). No central manifest, no hard-coded app lists.
6. **Faces are data, not code (target state).** A face is a configuration on top of a face engine. Community contributions are JSON files, not React PRs. See open decisions.
7. **Server is intentionally minimal.** Express serves `dist/` + a small device/admin API. No business logic on the server. Data flows: configured sources → client fetch → render.

## Principles

- **Composition over duplication.** Primitives (RingFace, RadialViz, ScenePicker, IntervalTimer, RoundList, WeekRing, AmbientMedia) get extracted once they have 3+ uses.
- **`isActive` lifecycle.** Components that tick (intervals, animations) gate on `props.isActive`. Background apps don't burn CPU.
- **Schema-driven UI.** Apps, faces, and complications declare zod schemas; admin and kiosk both resolve them locally. See [docs/admin/foundation.md §Schemas on the wire](../docs/admin/foundation.md).
- **Capability-driven rendering.** Devices declare what they support; admin renders controls off that list.
- **Layered architecture.** primitives → widgets → faces → apps → shell. Layers depend downward only.
- **Decisions are amendable.** This document captures intent at a point in time. When reality diverges, amend in the same PR.

## Vision-level pieces (not yet in code)

Part of horizon 3. The foundation does not commit to delivery; it commits to not making them impossible.

- **Multi-device pub/sub.** Push a scene, photo, or playlist from one device to another in the same household. Admin server already knows all devices; it lacks a device-to-device push channel.
- **Conversational layer.** Talk with Clawd via the Claude API + STT/TTS. A "voice mode" full-screen face renders the character animating while speaking.
- **Community face/scene library.** JSON face configs distributed via a manifest URL or GitHub folder. End-users browse, install, customize.
- **Visual face builder.** Eventually a web tool to compose layers into a face spec without writing JSON.

## Open decisions

Deferred to future PRs. Resolve in context, amending this doc in the same PR.

1. **Open-source contribution model for faces (A / B1 / B2 / C).** See [docs/architecture.md §Customization spectrum](../docs/architecture.md). Lean: **B1** (pure config on top of engines — matches existing infrastructure).
2. **Scale target — 100 apps vs 20 polished apps.** Determines primitive-kit investment level.
3. **Sequencing — primitive-first vs. build-and-extract.** Lean: build-and-extract from the next demanding app (Fitness).
4. **Multi-device sharing scope.** LAN-only vs. accounts + internet. Lean: LAN-only for horizon 3 v1.
5. **Conversational scope.** Chat-only first, or voice on day one. Lean: chat first; voice as a follow-up app.

## Governance

- This doc updates in PRs that change project-wide direction. Subsystem-scoped decisions update the relevant subsystem doc, not this one.
- Memory files in `.claude/projects/.../memory/` capture session-level observations; this doc captures committed direction.
- When a subsystem doc and this doc conflict, this doc wins for the *intent* (the why); the subsystem doc wins for the *spec* (the how).
- Examples files (`examples/`) are illustrative only and not authoritative — see global `CLAUDE.md`.
