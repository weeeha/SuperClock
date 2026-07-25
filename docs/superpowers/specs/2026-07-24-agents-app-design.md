# Agents app — design

**Date:** 2026-07-24
**Status:** Awaiting review
**Wireframes:** [FigJam → Designs page → "Agents" section](https://www.figma.com/board/JAjMCsw8hXx38locrxP5gd/SuperClock-fresh-thinking?node-id=17-628)
**Scope:** v1 is layout only, mocked data. The real backend (OpenClaw gateway via
Telegram or a lifeos API/MCP) is a later spec.

## What this is

A kiosk mini-app for talking to the 15 OpenClaw life-OS agents (Lifey, MyAI,
Dr. O'Body, Artist, Financeer, …) that run on the Mac Studio. Three views:

```
app grid → agent list → (tap) → chat ⇅ (vertical swipe) → fullscreen avatar
```

An agent here is a *contact* in v1 (list → chat), with the fullscreen avatar as
a per-agent sub-view. The parked long-term direction is an agent as an ambient
*presence* — a playlist-rotation face that wakes into conversation — and the
avatar view is deliberately built as a self-contained component so that future
needs no rework.

## Directions considered

- **A · Messenger on a disc** — chosen structure. List and chat as a familiar
  centred-column messenger. Cheapest, scales to 15 agents, gives `RoundList`
  its first consumer.
- **B · Orbital dial** — portraits on a bezel ring, radial selection. Most
  round-native, but an all-custom picker and fiddly at 15 items. Its one cheap,
  great idea — the **bezel state ring** — is stolen into A.
- **C · Presence, no list** — no list at all; agents cycle like watchfaces.
  The emotional endgame, but no overview/unread and it burns the vertical
  swipe. Parked, not dead: the avatar component is its future building block.

## The three views

### 1 · Agent list

`RoundList` exactly as spec'd in
[2026-07-21-roundlist-and-todo-design.md](2026-07-21-roundlist-and-todo-design.md):
centred `min(62%, 680px)` column, 96px rows, edge fade top and bottom, local
touch-scroll opt-in. **This app is the primitive's first consumer** (Todo is
not built yet); the build order inside this feature is RoundList → agent list.

Row: 56px round portrait, name, last-message preview (muted), unread dot on
the right. Header: "Agents". Unread state is mocked in v1.

### 2 · Chat

- Pinned top: 48px portrait + agent name. **Tapping the header goes back to
  the list** — vertical swipe is taken by the avatar view and horizontal swipe
  switches apps, so back must be a tap.
- Below: read-only bubble timeline in the centred column, agent left / user
  right, edge-faded, touch-scroll opted in locally.
- **No input bar, ever.** The input model is an always-on mic (future voice
  spec). Until voice lands, replies happen on Telegram.
- Bottom arc: small "● listening…" status text.

### 3 · Avatar

Fullscreen portrait filling the disc, agent name + one-line status in the
lower arc, state ring. No other chrome. Reached by vertical swipe from chat;
vertical swipe returns. Self-contained component (`AgentAvatarView`) so it can
later be mounted as a playlist face.

### The state ring

On chat and avatar views: a ~6–7px ring just inside the bezel showing the mic
state — **idle** (near-invisible) · **listening** (slow breathing glow) ·
**thinking** (soft shimmer) · **speaking** (steady bright). Pure CSS
(opacity/box-shadow keyframes on a single element), gated on `isActive`, dims
with night mode. In v1 the state machine is mocked; on the avatar view it
cycles through all four states so they can be evaluated visually. The radar
presence work is the intended future wake trigger.

## Data

```ts
interface Agent {
  id: string;          // 'main', 'health', …  (OpenClaw agent ids)
  name: string;        // 'Lifey', "Dr. O'Body", …
  portrait: string;    // /agents/<id>.png in public/
  lastMessage: { text: string; at: number } | null;
  unread: number;
}

interface AgentMessage {
  id: string;
  from: 'agent' | 'user';
  text: string;
  at: number;
}

interface AgentProvider {
  listAgents(): Promise<Agent[]>;
  getConversation(agentId: string): Promise<AgentMessage[]>;
  // reserved for the real backend:
  // sendMessage(agentId: string, text: string): Promise<void>;
}
```

v1 ships `MockAgentProvider` with the real 15 agents and canned conversations.
The Telegram / lifeos-API adapter later replaces one file, not the app — the
same pattern as `TodoStore` in the RoundList spec.

### Portraits

Generated set (nano-banana), flat illustration, one consistent palette across
all 15 agents, round-crop friendly, legible when night-dimmed. Hashed PNGs in
`public/agents/`, referenced by absolute path per the static-asset convention.

## Registration

The usual three-list dance plus schema, or `npm test` fails:

1. side-import in `src/apps/index.ts`
2. `ALL_KIOSK_APP_IDS` entry in `src/shared/capabilities.ts`
3. `app.agents` schema in `src/shared/schemas/` + `src/shared/schema-registry.ts`

Config schema `app.agents`: `defaultAgent` (string), `enabledAgents`
(string[], empty = all).

## Navigation invariants

- Entering chat/avatar for an agent must change the AnimatePresence key path
  the same way instances do — no action may set `mode: 'transitioning'`
  without changing the key (pinned by `navigation.test.ts`).
- The app registers a vertical-swipe callback only while a chat/avatar view is
  active and **must clear it on deactivate** (Habits discipline).
- All timers/animation (state-ring mock cycling) gate on `props.isActive`.

## Out of scope for v1

- Any real backend traffic; sending messages; real unread counts.
- Voice capture and the real mic state machine.
- Agent-as-playlist-face (direction C) — enabled by, not part of, this build.

## Acceptance criteria

1. `npm run build`, `npm run lint`, `npm test` all pass.
2. Agents appears in the app grid and admin app list.
3. List scrolls with edge fades; tap opens that agent's chat; header tap
   returns; vertical swipe toggles chat ⇅ avatar; leaving the app restores all
   gestures.
4. State ring visibly cycles its four states on the avatar view.
5. `enabledAgents` config filters the list; `defaultAgent` opens first.
6. Verified in the browser preview at 1080×1080, not only by passing tests.

## Sequence after this

1. Build `RoundList` + Agents app (this spec)
2. Todo onto `RoundList` — call site two, per the RoundList spec's own plan
3. OpenClaw gateway spec — read path first (real conversations), then send
4. Voice capture spec — real state machine for the ring
5. Agent-as-presence (direction C) — avatar view joins the playlist rotation
