# AI Face app: all 50 AI-Avatars designs on SuperClock

Date: 2026-10-09 · Branch: `claude/super-clock-ai-face-748b95` · Status: approved by Nick 2026-10-09 (decision 8.1 = A)

**TL;DR.** A new kiosk app, `ai-face`, shows any of the 50 character designs from [weeeha/AI-Avatars](https://github.com/weeeha/AI-Avatars) (merged PR 8) full-screen on the round display, driven by one shared state vocabulary (12 activities × 7 expressions + reactions). The original renderers are vendored from a pinned AI-Avatars commit and driven through a small per-family adapter, so nothing is redrawn and AI-Avatars stays the source of truth. v1 is driven by a demo or fixed state; a later `main-agent` source makes it Lifey's face. Fragment and Third Eye speak through fastclock's Fusion HAT speaker. Four sub-projects, one plan and build each.

## 1. Intent

- **Said by Nick:** a new SuperClock app that is "the AI face", eventually used for the main agent; implement all 50 designs; the face may become the home screen; voice plays through the HAT.
- **Assumed (correct me):** full-screen, one design per app instance, multiple instances allowed; driven by state, not by the gallery's manual controls; fastclock first.
- **Success:** every design selectable in the admin, renders on fastclock through the round mask, responds to every canonical activity and expression, costs nothing while the app is inactive, and is ready to be bound to the main agent without changing the app.

## 2. Source inventory (AI-Avatars `main`, after PR 8)

Each family is a generated page under `characters/<family>/` with a control API on `window`.

| Family | Designs | Renderer | Control API |
| --- | ---: | --- | --- |
| core-eyes | 16 | canvas2d | `AbstractPerformance.mount` → `setState/setEmotion/setPaused` |
| luminous-faces | 7 | canvas2d | same shared engine |
| assistant-iris | 1 | webgl | same shared engine |
| fractal-presence | 1 | webgl + canvas2d fallback | same shared engine |
| prismatic-lenses | 1 | webgl | `LensPerformance.mount`, `prismaticPreview` |
| lens-motion-ideas | 10 | webgl | `LensPerformance.mount`, `motionIdeasPreview` |
| cinematic-faces (Dot flock `eidolon`, Red eye `lens`) | 2 | canvas2d | `cinematicPreview` |
| fragment-faces (Fragment, Third Eye) | 2 | webgl + audio | `avatarPreview` |
| oracle | 1 | webgl | `oraclePreview.setMode/setEmotion/setPaused/react` |
| shape-cast | 8 | DOM artwork | `shapeCastPreview` (has `selectCharacter`) |
| open-skeleton | 1 | video (MP4) | `openSkeletonPreview.setActivity/react` |

Total 50. 33 are canvas2d/DOM/video, 17 need WebGL. The repo is 324 MB; what actually renders (pages, assets, PNG, MP4, manifests; no GIF, sources, concepts, frames) is about 40 MB.

## 3. Architecture

**Chosen: vendor and adapt.** Rejected: rewriting 11 renderers in React (drift from the source, the biggest build) and first turning AI-Avatars into an ES-module runtime (refactors 11 IIFE studies before anything is seen). The adapter contract below is shaped so that runtime package can replace the iframe later without the app changing.

```
AI-Avatars @ pinned SHA ──sync script──▶ public/avatars/<family>/…   (allowlisted, ~40 MB)
                                              │ same-origin iframe
ai-face app ──AvatarState──▶ FamilyAdapter ──▶ window.<api> inside the page
     ▲
AvatarStateSource (demo | fixed | main-agent later)
```

### 3.1 Units

- **`scripts/sync-avatars.mjs`** (`npm run sync:avatars -- <sha>`). Copies the allowlisted files from a local AI-Avatars checkout at the given SHA into `public/avatars/`, writes `public/avatars/VERSION` (SHA + date), and fails on any file outside the allowlist so a new upstream asset is a conscious decision. Never fetches over the network at build or runtime.
- **`src/apps/ai-face/designs.ts`.** The registry of 50 designs: `{ id: '<family>/<character>', family, name, renderer: 'canvas2d' | 'webgl' | 'video' | 'dom', voice: boolean }`. Ids are namespaced because `lens` (Red eye) and `aperture` (a core eye and an existing clock face) would otherwise collide.
- **`src/apps/ai-face/avatar-state.ts`.** The canonical vocabulary:
  - activities (12): `idle, starting, listening, thinking, researching, working, answering, waiting, needs-input, complete, error, sleeping`
  - expressions (7): `neutral, happy, curious, surprised, confused, concerned, playful`
  - reactions: one-shot, family-supported subset
  - `AvatarState = { activity, expression, reaction?: { kind, at } }`
- **`src/apps/ai-face/adapters/<family>.ts`.** One per family, implementing:
  ```ts
  interface FamilyAdapter {
    pagePath: string;                              // /avatars/<family>/index.html
    attach(win: Window, characterId: string): Promise<AvatarController>;
  }
  interface AvatarController {
    apply(state: AvatarState): void;   // maps canonical → family-native via the family's alias table
    setPaused(paused: boolean): void;
    setMuted(muted: boolean): void;    // no-op for silent families
    destroy(): void;
  }
  ```
  Each adapter owns a static mapping table (canonical activity/expression → native name) taken from the family's existing aliases. Where the page cannot select a character programmatically, the fix is a small `select(id)` added to that family's API upstream in AI-Avatars and re-synced; adapters do not poke the page's DOM controls.
- **`src/apps/ai-face/AvatarFrame.tsx`.** Mounts the iframe for one design: injects a kiosk stylesheet (hides `.page-nav` and every control panel, stage fills a 1080 × 1080 square, black background), waits for the API global, then hands the controller up. The iframe has `pointer-events: none` so the shell's swipe and arc gestures keep working; pointer-driven behaviors (Dot flock disturbance) are given up.
- **`src/apps/ai-face/sources/`.** `AvatarStateSource = { subscribe(cb: (s: AvatarState) => void): () => void }`, the same seam pattern as `AgentProvider`.
  - `demo`: cycles activities on the family's own entry/hold/exit timing, expressions drift slowly. Never shows operational conditions (offline, permission denied), because a demo must not claim a live failure. Shows a small "Demo" tell so it is never read as the agent being live.
  - `fixed`: pins the configured activity and expression.
  - `main-agent`: SP4 (section 7).
- **`src/apps/ai-face/AiFaceApp.tsx`.** Reads config via `app.ai-face` schema (`schema.safeParse(config ?? {})`), picks the source, renders `AvatarFrame`, optional time overlay.

### 3.2 Config: `app.ai-face` schema

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `design` | enum of 50 ids | `core-eyes/wheatley` | the admin gets a picker from the enum |
| `source` | `demo \| fixed` | `demo` | `main-agent` added in SP4 as a minor schema change |
| `activity` | enum of 12 | `idle` | used when `source = fixed` |
| `expression` | enum of 7 | `neutral` | used when `source = fixed` |
| `showTime` | boolean | `false` | small time label so the face can be the home screen without losing the clock |
| `sleepAtNight` | boolean | `true` | night window forces `sleeping` |
| `voice` | boolean | `true` | speech plays only if the design has voice and the device has `audio` |

Adding the app and later adding `main-agent` to the enum are both minor (`npm run snapshot:schemas`), no `FLEET_SCHEMA_VERSION` bump.

### 3.3 Home screen

No new mechanism. Home is `appOrder[0]` (`useIdleReturn.ts`), so putting an AI Face screen first in a device's screen order makes it home, and idle return comes back to it. `showTime` covers the clock-loss. If Nick later wants the face *inside* the clock app as a watchface, that is a separate face-registry change with the `--face-*` night contract and is out of scope here.

### 3.4 Voice through the Fusion HAT

- Only Fragment and Third Eye carry voice (prerecorded `hello.mp3` with amplitude-driven mouth; custom text uses browser speech synthesis).
- Gated on the device `audio` feature (fastclock only) and `voice: true`; muted everywhere else via `setMuted(true)`.
- v1 plays the prerecorded clips. Browser speech synthesis on the Pi's Chromium likely has no voices; real speech comes with SP4, where the agent supplies audio (fastclock has `pico2wave`) and the face follows its amplitude.
- Risks to verify on glass: Chromium's autoplay policy in the kiosk (an iframe may need `allow="autoplay"` plus the kiosk flag), the Fusion HAT speaker amp enable (`/sys/class/fusion_hat/fusion_hat/speaker`), and that the HAT is Chromium's default sink. The alerts chime has the same open item, so they verify together.

### 3.5 Pi safety

- **Active-aware (`KIO-1`).** On `isActive = false`: `setPaused(true)` immediately; unmount the iframe after 60 s inactive (frees GL contexts and video decoders). Reactivation remounts, a short fade covers the load.
- **Reduced motion** in the page is respected as-is.
- **`app-capabilities` row:** `ai-face: ['ticks']`. Voice is an optional enhancement gated at runtime on the device `audio` feature, so `audio` is not declared as a need (declaring it would mark the app as unable to run on Small and Square). The `app-capabilities.test.ts` detector reads the iframe pages, not the app, so the row's `ticks` claim needs a ledger note or a detector tweak; the plan settles which.
- **Slow (LVGL)** is excluded; the app is not offered there.
- **WebGL on the Pi 4 clocks (Small, Square)** is an open decision, see section 8. Default until decided: allowed, protected by the runtime frame guard.

### 3.6 Runtime frame guard (the default for section 8)

`AvatarFrame` samples frame time for the first 10 s and then every minute. If the median stays under 24 fps for 5 s, it first halves the render scale (canvas at 540, CSS-upscaled), and if still under, it pauses on the current pose with a small "Paused to keep the clock cool" tell. The guard logs its decision to the console with the design id so SP3 can collect numbers.

## 4. Testing

- **Contract test** (`designs.test.ts`): 50 designs; ids unique; every design's family has an adapter; every adapter's mapping table covers all 12 activities and 7 expressions with a native value; the schema enum equals the registry ids.
- **Sync test** (`sync-avatars.test.ts`): allowlist rejects an unknown file; `VERSION` written; every `pagePath` in the registry exists under `public/avatars/`.
- **Source tests**: demo never emits a condition, fixed emits exactly the config, night forces `sleeping` when `sleepAtNight`.
- **Frame guard**: pure function over a frame-time series, unit tested.
- **Registry gates**: coherence, contract, schema-liveness, snapshot, `docs-drift` (README / foundation / architecture app counts), health and declared-vs-read regenerated.
- **Browser**: dev kiosk at a true 1080 × 1080 viewport (front and size the pane first), every design loaded once, each family cycled through all activities, screenshot per family through the round mask. Chrome and Safari for the admin picker.
- **On glass (SP3)**: per device, per renderer class, measured fps and SoC temperature after 10 minutes.

## 5. Sub-projects

Each gets its own plan and build; each lands as local commits plus an agent-log entry.

| SP | Scope | Depends on | Build shape |
| --- | --- | --- | --- |
| **SP1 Foundation + abstract engine** | sync script + allowlist, design registry, canonical state, adapter contract, `AvatarFrame`, demo and fixed sources, schema, scaffold via `npm run new:app -- ai-face`, docs-drift; adapters for core-eyes, luminous-faces, assistant-iris, fractal-presence (25 designs on one engine) | none | 2 to 3 Sonnet implementers in sequence, controller reviews every diff |
| **SP2 Remaining families** | adapters for prismatic-lenses + lens-motion-ideas (11), cinematic-faces (2), fragment-faces (2, voice), oracle (1), shape-cast (8), open-skeleton (1, video); any upstream `select(id)` additions in AI-Avatars | SP1 | one phase of 6 Sonnet agents in parallel, one per family, then a controller integration pass |
| **SP3 On-glass qualification** | deploy to fastclock, measure every renderer class, HAT voice check, then Small and Square; admin thumbnails for the 50 designs; record a per-device qualification table | SP2 | controller-driven, on hardware |
| **SP4 Main agent** | `main-agent` source mapping Lifey's events (listening, thinking, answering, needs-input, error, done) onto `AvatarState`; mic-driven `listening` on fastclock; agent-supplied speech through the HAT | the real agent backend (`AgentProvider` is still mock) | spec addendum when the backend exists |

## 6. Non-goals

Pointer interaction with the faces; showing the gallery's control panels; LVGL ports; the face as a clock-app watchface; editing designs in SuperClock (edit upstream, re-sync).

## 7. SP4 acceptance (recorded now so the seam is built for it)

Switching `source` to `main-agent` changes no other file in the app. Agent offline shows the family's labelled offline condition (honest offline), never a demo cycle. Speech audio and mouth motion come from the same buffer.

## 8. Open decisions for Nick

1. **WebGL designs on Small and Square (Pi 4).** Decided 2026-10-09: **A**. Options considered:
   - **A. Allow with the runtime frame guard (recommended, the current default).** Every design is offered everywhere; a struggling design steps down to half resolution, then pauses with a tell. Nothing is blocked on measurements.
   - B. Allow only designs that pass SP3's measured qualification per device; the admin hides the rest. Safest, but nothing WebGL shows on Pi 4 until SP3 runs.
   - C. Always render WebGL at half resolution on Pi 4. Simple, softer image even when it would have coped.
   - D. Block WebGL on Pi 4 entirely. 17 designs become fastclock-only.
2. **Upstream edits to AI-Avatars.** Some families may need a small `select(id)` API addition upstream. Default: make it on a branch in AI-Avatars and re-sync from that SHA.
