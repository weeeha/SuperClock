# Agents App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kiosk mini-app for the 15 OpenClaw life-OS agents — agent list → chat → fullscreen avatar, all mocked data, per `docs/superpowers/specs/2026-07-24-agents-app-design.md`.

**Architecture:** New app module `src/apps/agents/` behind the standard `registerApp` pattern. It introduces `src/core/widgets/RoundList.tsx` (first consumer of the spec'd primitive), a pure view-state machine (list/chat/avatar) tested in node, a `MockAgentProvider` behind the `AgentProvider` interface, and a CSS-only `StateRing` mic indicator. No backend traffic in v1.

**Tech Stack:** React 19, zustand navigation store (existing), zod schemas, Vitest (node-only — this repo has NO jsdom/@testing-library, so tests cover pure logic and registries; rendering is verified in the 1080×1080 browser preview, matching how every existing app is tested).

**Worktree gotcha:** this worktree has no `node_modules` yet. Task 0 runs `npm ci` first — nothing works before that. ESLint runs the full react-hooks v7 Compiler ruleset: keep effect deps exact, never call hooks conditionally.

**Navigation invariant (read before Task 9):** in-app view changes (list↔chat↔avatar) must NOT touch the navigation store's `mode` — they are plain local state. Only the shell sets `mode: 'transitioning'`. The app's only store interaction is `setVerticalSwipeCallback`, which MUST be cleared on deactivate and on unmount (Habits pattern, `src/apps/habits/HabitsApp.tsx:226-245`).

---

### Task 0: Worktree setup + baseline

**Files:** none (environment only)

- [ ] **Step 0.1: Install deps**

Run: `npm ci`
Expected: completes without errors; `node_modules/.bin/vitest` exists.

- [ ] **Step 0.2: Baseline gates**

Run: `npm test`
Expected: 4 test files pass (calendar-utils, navigation, registry-coherence, time-window). If anything fails here, STOP — the baseline is broken, do not build on it.

---

### Task 1: `RoundList` primitive

**Files:**
- Create: `src/core/widgets/RoundList.tsx`

The API is fixed by the RoundList spec (`docs/superpowers/specs/2026-07-21-roundlist-and-todo-design.md`). Purely presentational — no timers, nothing to gate on `isActive`, no node-testable logic; verified in preview (Task 11). Touch/scroll is locked globally in `src/index.css`, so this component opts back in locally via `overflow-y: auto` + `touch-action: pan-y`.

- [ ] **Step 1.1: Implement**

```tsx
// src/core/widgets/RoundList.tsx
//
// Scrolling list for the circular 1080×1080 viewport. Centred column at
// min(62%, 680px) so rows never hit the bezel curve; top/bottom edges
// dissolve via a CSS mask instead of clipping. First consumer: Agents app.
// API pinned by docs/superpowers/specs/2026-07-21-roundlist-and-todo-design.md.
import type { ReactNode } from 'react';

export interface RoundListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onSelect?: (item: T, index: number) => void;
  /** Row height in px. Default 96 — below ~72 the touch target is too small. */
  itemHeight?: number;
  /** Fixed content above the scroll area (title, count). */
  header?: ReactNode;
  /** Shown when items is empty. Required — an empty list must say why. */
  empty: ReactNode;
}

const FADE = 64;
const MASK = `linear-gradient(to bottom, transparent 0, black ${FADE}px, black calc(100% - ${FADE}px), transparent 100%)`;

export default function RoundList<T>({
  items,
  renderItem,
  onSelect,
  itemHeight = 96,
  header,
  empty,
}: RoundListProps<T>) {
  return (
    <div className="w-full h-full flex flex-col items-center">
      {header}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          width: 'min(62%, 680px)',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          maskImage: MASK,
          WebkitMaskImage: MASK,
        }}
      >
        {items.length === 0
          ? empty
          : items.map((item, i) => (
              <div
                key={i}
                style={{ height: itemHeight }}
                onClick={() => onSelect?.(item, i)}
              >
                {renderItem(item, i)}
              </div>
            ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 1.2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 1.3: Commit**

```bash
git add src/core/widgets/RoundList.tsx
git commit -m "feat: RoundList primitive per spec (centred column, edge fade)"
```

---

### Task 2: Agent data + `MockAgentProvider` (TDD)

**Files:**
- Create: `src/apps/agents/provider.ts`
- Test: `src/apps/agents/provider.test.ts`

- [ ] **Step 2.1: Write the failing test**

```ts
// src/apps/agents/provider.test.ts
import { describe, it, expect } from 'vitest';
import { mockAgentProvider, AGENT_IDS } from './provider';

describe('MockAgentProvider', () => {
  it('lists all 15 agents in stable order', async () => {
    const agents = await mockAgentProvider.listAgents();
    expect(agents.map((a) => a.id)).toEqual(AGENT_IDS);
    expect(agents).toHaveLength(15);
  });

  it('every agent has name, portrait path, and lastMessage', async () => {
    for (const a of await mockAgentProvider.listAgents()) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.portrait).toBe(`/agents/${a.id}.png`);
      expect(a.lastMessage).not.toBeNull();
    }
  });

  it('every agent has a non-empty conversation ending with its lastMessage', async () => {
    for (const a of await mockAgentProvider.listAgents()) {
      const msgs = await mockAgentProvider.getConversation(a.id);
      expect(msgs.length).toBeGreaterThan(0);
      expect(msgs[msgs.length - 1].text).toBe(a.lastMessage!.text);
    }
  });

  it('unknown agent id yields an empty conversation, not a crash', async () => {
    expect(await mockAgentProvider.getConversation('nope')).toEqual([]);
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx vitest run src/apps/agents/provider.test.ts`
Expected: FAIL — cannot resolve `./provider`.

- [ ] **Step 2.3: Implement**

```ts
// src/apps/agents/provider.ts
//
// AgentProvider is the seam for the future real backend (OpenClaw gateway via
// Telegram or lifeos API/MCP) — the adapter replaces mockAgentProvider, the
// app never changes. Same pattern as TodoStore in the RoundList spec.

export interface Agent {
  id: string;
  name: string;
  portrait: string; // /agents/<id>.png in public/
  lastMessage: { text: string; at: number } | null;
  unread: number;   // mocked in v1
}

export interface AgentMessage {
  id: string;
  from: 'agent' | 'user';
  text: string;
  at: number;
}

export interface AgentProvider {
  listAgents(): Promise<Agent[]>;
  getConversation(agentId: string): Promise<AgentMessage[]>;
  // reserved for the real backend:
  // sendMessage(agentId: string, text: string): Promise<void>;
}

// The real OpenClaw agent ids on the Mac Studio gateway.
export const AGENT_IDS = [
  'main', 'chat', 'health', 'selfhelp', 'builder', 'jobsearcher', 'gardener',
  'artist', 'financeer', 'speaker', 'knowledge', 'design-business',
  'dating-coach', 'filmmaker', 'lifeos',
] as const;

const NAMES: Record<string, string> = {
  main: 'Lifey', chat: 'MyAI', health: "Dr. O'Body", selfhelp: 'Selfhelp',
  builder: 'Builder', jobsearcher: 'Jobsearcher', gardener: 'Gardener',
  artist: 'Artist', financeer: 'Financeer', speaker: 'Speaker',
  knowledge: 'Knowledger', 'design-business': 'Design Business',
  'dating-coach': 'Dating Coach', filmmaker: 'Film Maker', lifeos: 'LifeOS',
};

// Canned conversations. Each ends with the row-preview message. Timestamps are
// static epoch ms — mocked data must not pretend to be live (honest-offline
// convention: nothing here claims freshness).
const T0 = 1753300000000;
const msg = (id: string, from: 'agent' | 'user', text: string, minAgo: number): AgentMessage =>
  ({ id, from, text, at: T0 - minAgo * 60_000 });

const CONVERSATIONS: Record<string, AgentMessage[]> = {
  main: [
    msg('m1', 'agent', 'Morning! Sleep 82. First meeting at 10:00.', 60),
    msg('m2', 'user', 'What else is on today?', 58),
    msg('m3', 'agent', 'Board review at 10, gym at 18. I moved your focus block to 14:00.', 57),
    msg('m4', 'user', 'Perfect.', 55),
    msg('m5', 'agent', 'Also — Financeer flagged 3 transactions.', 40),
  ],
  chat: [
    msg('c1', 'user', 'Give me a good metaphor for config drift.', 300),
    msg('c2', 'agent', 'A choir where every singer tunes to a different recording of the same note.', 299),
  ],
  health: [
    msg('h1', 'agent', 'HRV trending up this week. Keep the early bedtime.', 1500),
    msg('h2', 'user', 'Will do, doc.', 1499),
    msg('h3', 'agent', 'Sleep score 82 — nice.', 1440),
  ],
  selfhelp: [msg('s1', 'agent', 'Weekly review is due — 10 minutes tonight?', 2000)],
  builder: [msg('b1', 'agent', 'CI is green on the radar branch.', 2500)],
  jobsearcher: [msg('j1', 'agent', 'Two new roles match the design-engineer filter.', 3000)],
  gardener: [msg('g1', 'agent', 'Basil needs water — soil sensor at 18%.', 3500)],
  artist: [msg('a1', 'agent', 'New sketch uploaded.', 4000)],
  financeer: [msg('f1', 'agent', '3 transactions to review.', 4500)],
  speaker: [msg('sp1', 'agent', 'Talk outline draft is ready for a pass.', 5000)],
  knowledge: [msg('k1', 'agent', 'Saved 4 highlights from yesterday’s reading.', 5500)],
  'design-business': [msg('d1', 'agent', 'Invoice #12 was paid.', 6000)],
  'dating-coach': [msg('dc1', 'agent', 'Sunday plan looks solid. Be curious, not impressive.', 6500)],
  filmmaker: [msg('fm1', 'agent', 'Rough cut exported — 4m12s.', 7000)],
  lifeos: [msg('l1', 'agent', 'All systems nominal. 3 automations ran today.', 7500)],
};

// A couple of unread dots so the list row layout is provable; purely mock.
const UNREAD: Record<string, number> = { main: 2, health: 1 };

const AGENTS: Agent[] = AGENT_IDS.map((id) => {
  const conv = CONVERSATIONS[id] ?? [];
  const last = conv[conv.length - 1];
  return {
    id,
    name: NAMES[id],
    portrait: `/agents/${id}.png`,
    lastMessage: last ? { text: last.text, at: last.at } : null,
    unread: UNREAD[id] ?? 0,
  };
});

export const mockAgentProvider: AgentProvider = {
  listAgents: () => Promise.resolve(AGENTS),
  getConversation: (agentId) => Promise.resolve(CONVERSATIONS[agentId] ?? []),
};
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `npx vitest run src/apps/agents/provider.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 2.5: Commit**

```bash
git add src/apps/agents/provider.ts src/apps/agents/provider.test.ts
git commit -m "feat: AgentProvider interface + mock with the 15 OpenClaw agents"
```

---

### Task 3: View state machine (TDD)

**Files:**
- Create: `src/apps/agents/view-state.ts`
- Test: `src/apps/agents/view-state.test.ts`

Pure functions so the list/chat/avatar transitions are node-testable without DOM.

- [ ] **Step 3.1: Write the failing test**

```ts
// src/apps/agents/view-state.test.ts
import { describe, it, expect } from 'vitest';
import { openAgent, backToList, onVerticalSwipe, type AgentsView } from './view-state';

describe('agents view state', () => {
  it('opening an agent goes to chat', () => {
    expect(openAgent('main')).toEqual({ kind: 'chat', agentId: 'main' });
  });

  it('back returns to list from anywhere', () => {
    expect(backToList()).toEqual({ kind: 'list' });
  });

  it('vertical swipe toggles chat ⇅ avatar in both directions', () => {
    const chat: AgentsView = { kind: 'chat', agentId: 'main' };
    const avatar: AgentsView = { kind: 'avatar', agentId: 'main' };
    expect(onVerticalSwipe(chat, 'up')).toEqual(avatar);
    expect(onVerticalSwipe(chat, 'down')).toEqual(avatar);
    expect(onVerticalSwipe(avatar, 'up')).toEqual(chat);
    expect(onVerticalSwipe(avatar, 'down')).toEqual(chat);
  });

  it('vertical swipe on the list is a no-op (shell keeps swipe-down → grid)', () => {
    const list: AgentsView = { kind: 'list' };
    expect(onVerticalSwipe(list, 'down')).toEqual(list);
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npx vitest run src/apps/agents/view-state.test.ts`
Expected: FAIL — cannot resolve `./view-state`.

- [ ] **Step 3.3: Implement**

```ts
// src/apps/agents/view-state.ts
export type AgentsView =
  | { kind: 'list' }
  | { kind: 'chat'; agentId: string }
  | { kind: 'avatar'; agentId: string };

export function openAgent(agentId: string): AgentsView {
  return { kind: 'chat', agentId };
}

export function backToList(): AgentsView {
  return { kind: 'list' };
}

/** Chat ⇅ avatar toggles on either direction (wireframe: "both ways").
 *  On the list, vertical swipes stay unclaimed so the shell's default
 *  (swipe-down opens the grid) keeps working. */
export function onVerticalSwipe(view: AgentsView, _dir: 'up' | 'down'): AgentsView {
  if (view.kind === 'chat') return { kind: 'avatar', agentId: view.agentId };
  if (view.kind === 'avatar') return { kind: 'chat', agentId: view.agentId };
  return view;
}
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `npx vitest run src/apps/agents/view-state.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 3.5: Commit**

```bash
git add src/apps/agents/view-state.ts src/apps/agents/view-state.test.ts
git commit -m "feat: agents view-state machine (list/chat/avatar, pure + tested)"
```

---

### Task 4: Registration (schema + capabilities + registry) — coherence-test-driven

**Files:**
- Create: `src/shared/schemas/app.agents.ts`
- Create: `src/apps/agents/index.ts`
- Create: `src/apps/agents/AgentsApp.tsx` (stub — real UI in Tasks 5–9)
- Modify: `src/shared/schema-registry.ts` (import + entry, alphabetical between `app.` entries)
- Modify: `src/shared/capabilities.ts:22-35` (add `'agents'` to `ALL_KIOSK_APP_IDS`)
- Modify: `src/apps/index.ts` (side-import)

The registry-coherence test IS the failing test for this task.

- [ ] **Step 4.1: Add `'agents'` to capabilities only, run coherence test, watch it fail**

In `src/shared/capabilities.ts`, add `'agents',` as the first entry of `ALL_KIOSK_APP_IDS` (list is not alphabetical; first slot keeps the diff obvious).

Run: `npx vitest run src/shared/registry-coherence.test.ts`
Expected: FAIL — `capabilities advertises unknown app 'agents'` and `schema 'app.agents' missing`. This proves the test guards this task.

- [ ] **Step 4.2: Schema file**

```ts
// src/shared/schemas/app.agents.ts
import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const agentsAppSchema = z.object({
  defaultAgent: z.string().default('main'),
  enabledAgents: z.array(z.string()).default([]),
});

export const agentsAppMeta: FieldMetaMap = {
  defaultAgent: { description: 'Agent pinned to the top of the list (OpenClaw id, e.g. main)' },
  enabledAgents: { description: 'Agent ids to show; empty = all 15' },
};

export type AgentsAppConfig = z.infer<typeof agentsAppSchema>;
```

- [ ] **Step 4.3: Register the schema**

In `src/shared/schema-registry.ts`, add to the app imports block (keep alphabetical):

```ts
import { agentsAppSchema, agentsAppMeta } from './schemas/app.agents';
```

and to `SCHEMAS` (first app entry):

```ts
'app.agents': { schema: agentsAppSchema, meta: agentsAppMeta },
```

- [ ] **Step 4.4: App stub + registration**

```tsx
// src/apps/agents/AgentsApp.tsx  (stub — replaced across Tasks 5–9)
import type { AppProps } from '../../core/types';

export default function AgentsApp(_props: AppProps) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black text-white">
      Agents
    </div>
  );
}
```

```ts
// src/apps/agents/index.ts
import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'agents',
    name: 'Agents',
    icon: '\u{1F9E0}',
    description: 'Chat with your life-OS agents',
    category: 'productivity',
  },
  component: lazy(() => import('./AgentsApp')),
});
```

In `src/apps/index.ts` append:

```ts
import './agents';
```

- [ ] **Step 4.5: Run the full suite**

Run: `npm test`
Expected: PASS — coherence test green again, everything else untouched.

- [ ] **Step 4.6: Commit**

```bash
git add src/shared/schemas/app.agents.ts src/shared/schema-registry.ts src/shared/capabilities.ts src/apps/index.ts src/apps/agents/index.ts src/apps/agents/AgentsApp.tsx
git commit -m "feat: register agents app (schema, capabilities, registry)"
```

---

### Task 5: Agent list view on RoundList

**Files:**
- Create: `src/apps/agents/AgentPortrait.tsx`
- Create: `src/apps/agents/AgentListView.tsx`

- [ ] **Step 5.1: Portrait component with initial-letter fallback**

Portraits (Task 10) may not exist yet; the fallback keeps every earlier task previewable and covers a missing/corrupt PNG on-device.

```tsx
// src/apps/agents/AgentPortrait.tsx
import { useState } from 'react';

export default function AgentPortrait({
  name,
  src,
  size,
}: {
  name: string;
  src: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="rounded-full bg-neutral-700 text-neutral-300 flex items-center justify-center font-semibold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {name.charAt(0)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
```

- [ ] **Step 5.2: List view**

```tsx
// src/apps/agents/AgentListView.tsx
import RoundList from '../../core/widgets/RoundList';
import AgentPortrait from './AgentPortrait';
import type { Agent } from './provider';

export default function AgentListView({
  agents,
  onSelect,
}: {
  agents: Agent[];
  onSelect: (agent: Agent) => void;
}) {
  return (
    <div className="w-full h-full bg-black text-white pt-24 pb-16">
      <RoundList
        items={agents}
        onSelect={onSelect}
        header={
          <h1 className="text-4xl font-semibold text-center mb-6">Agents</h1>
        }
        empty={
          <p className="text-neutral-400 text-center mt-24">
            No agents enabled — check enabledAgents in the admin.
          </p>
        }
        renderItem={(a) => (
          <div className="h-full flex items-center gap-5 px-4 rounded-3xl active:bg-neutral-900">
            <AgentPortrait name={a.name} src={a.portrait} size={56} />
            <div className="flex-1 min-w-0">
              <div className="text-2xl font-semibold leading-tight">{a.name}</div>
              <div className="text-base text-neutral-400 truncate">
                {a.lastMessage?.text ?? 'No messages yet'}
              </div>
            </div>
            {a.unread > 0 && (
              <div className="w-3.5 h-3.5 rounded-full bg-sky-400 shrink-0" />
            )}
          </div>
        )}
      />
    </div>
  );
}
```

- [ ] **Step 5.3: Wire into `AgentsApp` with config**

Replace the Task 4 stub entirely:

```tsx
// src/apps/agents/AgentsApp.tsx
import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import { mockAgentProvider, type Agent } from './provider';
import { openAgent, type AgentsView } from './view-state';
import AgentListView from './AgentListView';

export default function AgentsApp({ isActive, config }: AppProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [view, setView] = useState<AgentsView>({ kind: 'list' });

  useEffect(() => {
    let cancelled = false;
    mockAgentProvider.listAgents().then((a) => {
      if (!cancelled) setAgents(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledAgents = (config?.enabledAgents as string[] | undefined) ?? [];
  const defaultAgent = (config?.defaultAgent as string | undefined) ?? 'main';

  const visible = useMemo(() => {
    const filtered =
      enabledAgents.length > 0
        ? agents.filter((a) => enabledAgents.includes(a.id))
        : agents;
    // defaultAgent pinned to the top; original order otherwise.
    return [...filtered].sort((a, b) =>
      a.id === defaultAgent ? -1 : b.id === defaultAgent ? 1 : 0,
    );
  }, [agents, enabledAgents, defaultAgent]);

  void isActive; // consumed from Task 6 on (state ring + swipe callback)

  if (view.kind === 'list') {
    return (
      <AgentListView agents={visible} onSelect={(a) => setView(openAgent(a.id))} />
    );
  }
  // chat/avatar arrive in Tasks 7–9
  return null;
}
```

Note: `Array.prototype.sort` with a comparator that only distinguishes the pinned id is stable in modern V8 — the remaining 14 keep provider order.

- [ ] **Step 5.4: Typecheck + tests**

Run: `npx tsc -b && npm test`
Expected: clean; all tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/apps/agents/AgentPortrait.tsx src/apps/agents/AgentListView.tsx src/apps/agents/AgentsApp.tsx
git commit -m "feat: agent list view on RoundList (portraits, previews, unread)"
```

---

### Task 6: Mic state + `StateRing` (TDD on the cycle logic)

**Files:**
- Create: `src/apps/agents/mic-state.ts`
- Test: `src/apps/agents/mic-state.test.ts`
- Create: `src/apps/agents/agents.css`
- Create: `src/apps/agents/StateRing.tsx`

- [ ] **Step 6.1: Write the failing test**

```ts
// src/apps/agents/mic-state.test.ts
import { describe, it, expect } from 'vitest';
import { MIC_STATES, nextMicState } from './mic-state';

describe('mic state cycle', () => {
  it('cycles idle → listening → thinking → speaking → idle', () => {
    expect(MIC_STATES).toEqual(['idle', 'listening', 'thinking', 'speaking']);
    expect(nextMicState('idle')).toBe('listening');
    expect(nextMicState('speaking')).toBe('idle');
  });
});
```

- [ ] **Step 6.2: Run test to verify it fails**

Run: `npx vitest run src/apps/agents/mic-state.test.ts`
Expected: FAIL — cannot resolve `./mic-state`.

- [ ] **Step 6.3: Implement mic-state**

```ts
// src/apps/agents/mic-state.ts
export const MIC_STATES = ['idle', 'listening', 'thinking', 'speaking'] as const;
export type MicState = (typeof MIC_STATES)[number];

export function nextMicState(s: MicState): MicState {
  return MIC_STATES[(MIC_STATES.indexOf(s) + 1) % MIC_STATES.length];
}
```

- [ ] **Step 6.4: Run test to verify it passes**

Run: `npx vitest run src/apps/agents/mic-state.test.ts`
Expected: PASS.

- [ ] **Step 6.5: Ring CSS + component**

```css
/* src/apps/agents/agents.css — StateRing keyframes. Pure CSS: one element,
   opacity/box-shadow only, cheap on a Pi. Night mode dims globally via
   apply-settings; no special-casing here. */
@keyframes agents-ring-breathe {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
@keyframes agents-ring-shimmer {
  0% { opacity: 0.55; transform: rotate(0deg); }
  100% { opacity: 0.55; transform: rotate(360deg); }
}
```

```tsx
// src/apps/agents/StateRing.tsx
import type { MicState } from './mic-state';
import './agents.css';

const RING = '#3dadff';

/** Always-on-mic indicator: a ring just inside the bezel.
 *  idle: near-invisible · listening: breathing · thinking: shimmer (rotating
 *  conic gap) · speaking: steady bright. Parent must gate rendering on
 *  isActive — an unmounted ring is the cheapest ring. */
export default function StateRing({ state }: { state: MicState }) {
  const base: React.CSSProperties = {
    position: 'absolute',
    inset: 10,
    borderRadius: '50%',
    border: `7px solid ${RING}`,
    pointerEvents: 'none',
  };
  if (state === 'idle') return <div style={{ ...base, opacity: 0.08 }} />;
  if (state === 'listening')
    return (
      <div style={{ ...base, animation: 'agents-ring-breathe 2.4s ease-in-out infinite' }} />
    );
  if (state === 'thinking')
    return (
      <div
        style={{
          ...base,
          border: 'none',
          background: `conic-gradient(${RING} 0deg, ${RING} 300deg, transparent 300deg)`,
          WebkitMask: 'radial-gradient(closest-side, transparent calc(100% - 7px), black calc(100% - 7px))',
          mask: 'radial-gradient(closest-side, transparent calc(100% - 7px), black calc(100% - 7px))',
          animation: 'agents-ring-shimmer 3s linear infinite',
        }}
      />
    );
  return <div style={{ ...base, opacity: 1 }} />; // speaking
}
```

- [ ] **Step 6.6: Typecheck, then commit**

Run: `npx tsc -b`

```bash
git add src/apps/agents/mic-state.ts src/apps/agents/mic-state.test.ts src/apps/agents/agents.css src/apps/agents/StateRing.tsx
git commit -m "feat: mic-state cycle + StateRing (idle/listening/thinking/speaking)"
```

---

### Task 7: Chat view

**Files:**
- Create: `src/apps/agents/AgentChatView.tsx`

- [ ] **Step 7.1: Implement**

```tsx
// src/apps/agents/AgentChatView.tsx
import { useEffect, useState } from 'react';
import { mockAgentProvider, type Agent, type AgentMessage } from './provider';
import AgentPortrait from './AgentPortrait';
import StateRing from './StateRing';
import type { MicState } from './mic-state';

const MASK =
  'linear-gradient(to bottom, transparent 0, black 48px, black calc(100% - 48px), transparent 100%)';

export default function AgentChatView({
  agent,
  micState,
  onBack,
}: {
  agent: Agent;
  micState: MicState;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    mockAgentProvider.getConversation(agent.id).then((m) => {
      if (!cancelled) setMessages(m);
    });
    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  return (
    <div className="relative w-full h-full bg-black text-white flex flex-col items-center">
      <StateRing state={micState} />

      {/* Header — the back affordance (vertical swipe is avatar, horizontal is apps) */}
      <button
        onClick={onBack}
        className="flex flex-col items-center gap-1 pt-16 pb-2 active:opacity-70"
      >
        <AgentPortrait name={agent.name} src={agent.portrait} size={48} />
        <span className="text-2xl font-semibold">{agent.name}</span>
      </button>

      {/* Read-only timeline. No input bar, ever. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 py-6"
        style={{
          width: 'min(62%, 680px)',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          maskImage: MASK,
          WebkitMaskImage: MASK,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.from === 'agent'
                ? 'self-start bg-neutral-800 rounded-3xl px-5 py-3 max-w-[70%] text-lg'
                : 'self-end bg-sky-900 rounded-3xl px-5 py-3 max-w-[70%] text-lg'
            }
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="pb-14 text-sky-400 text-lg">● listening…</div>
    </div>
  );
}
```

- [ ] **Step 7.2: Typecheck + commit**

Run: `npx tsc -b`

```bash
git add src/apps/agents/AgentChatView.tsx
git commit -m "feat: agent chat view (read-only bubbles, header back, state ring)"
```

---

### Task 8: Avatar view

**Files:**
- Create: `src/apps/agents/AgentAvatarView.tsx`

Deliberately self-contained (agent + micState in, nothing else) so it can later mount as a playlist "presence" face — parked direction C in the spec.

- [ ] **Step 8.1: Implement**

```tsx
// src/apps/agents/AgentAvatarView.tsx
import type { Agent } from './provider';
import AgentPortrait from './AgentPortrait';
import StateRing from './StateRing';
import type { MicState } from './mic-state';

const STATUS: Record<MicState, string> = {
  idle: ' ',
  listening: '●  listening…',
  thinking: '●  thinking…',
  speaking: '●  speaking',
};

export default function AgentAvatarView({
  agent,
  micState,
}: {
  agent: Agent;
  micState: MicState;
}) {
  return (
    <div className="relative w-full h-full bg-black text-white flex flex-col items-center justify-center">
      <StateRing state={micState} />
      <AgentPortrait name={agent.name} src={agent.portrait} size={520} />
      <div className="text-5xl font-semibold mt-10">{agent.name}</div>
      <div className="text-2xl text-sky-400 mt-4 h-8">{STATUS[micState]}</div>
    </div>
  );
}
```

- [ ] **Step 8.2: Typecheck + commit**

Run: `npx tsc -b`

```bash
git add src/apps/agents/AgentAvatarView.tsx
git commit -m "feat: fullscreen avatar view (self-contained for future presence face)"
```

---

### Task 9: Wire it together (vertical swipe + mock state cycling)

**Files:**
- Modify: `src/apps/agents/AgentsApp.tsx` (replace Task 5 version entirely)

- [ ] **Step 9.1: Final `AgentsApp`**

```tsx
// src/apps/agents/AgentsApp.tsx
import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { mockAgentProvider, type Agent } from './provider';
import { openAgent, backToList, onVerticalSwipe, type AgentsView } from './view-state';
import { MIC_STATES, nextMicState, type MicState } from './mic-state';
import AgentListView from './AgentListView';
import AgentChatView from './AgentChatView';
import AgentAvatarView from './AgentAvatarView';

export default function AgentsApp({ isActive, config }: AppProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [view, setView] = useState<AgentsView>({ kind: 'list' });
  const [micState, setMicState] = useState<MicState>(MIC_STATES[0]);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);

  useEffect(() => {
    let cancelled = false;
    mockAgentProvider.listAgents().then((a) => {
      if (!cancelled) setAgents(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Vertical swipe toggles chat ⇅ avatar — registered ONLY while a per-agent
  // view is active, cleared on deactivate/unmount (navigation invariant; the
  // Habits pattern). On the list we register nothing, so the shell's
  // swipe-down → grid keeps working.
  useEffect(() => {
    if (!isActive || view.kind === 'list') {
      setVerticalSwipeCallback(null);
      return;
    }
    setVerticalSwipeCallback((dir) => setView((v) => onVerticalSwipe(v, dir)));
    return () => setVerticalSwipeCallback(null);
  }, [isActive, view, setVerticalSwipeCallback]);

  // Mock mic-state machine: cycles every 4s so all four ring states are
  // reviewable (spec acceptance #4). Gated on isActive — background apps
  // must not tick. Replaced by the real voice pipeline later.
  useEffect(() => {
    if (!isActive || view.kind === 'list') return;
    const id = setInterval(() => setMicState((s) => nextMicState(s)), 4000);
    return () => clearInterval(id);
  }, [isActive, view.kind]);

  const enabledAgents = (config?.enabledAgents as string[] | undefined) ?? [];
  const defaultAgent = (config?.defaultAgent as string | undefined) ?? 'main';

  const visible = useMemo(() => {
    const filtered =
      enabledAgents.length > 0
        ? agents.filter((a) => enabledAgents.includes(a.id))
        : agents;
    return [...filtered].sort((a, b) =>
      a.id === defaultAgent ? -1 : b.id === defaultAgent ? 1 : 0,
    );
  }, [agents, enabledAgents, defaultAgent]);

  if (view.kind === 'list') {
    return (
      <AgentListView agents={visible} onSelect={(a) => setView(openAgent(a.id))} />
    );
  }

  const agent = agents.find((a) => a.id === view.agentId);
  if (!agent) {
    // Config changed under us (agent disabled mid-view) — fall back honestly.
    return (
      <AgentListView agents={visible} onSelect={(a) => setView(openAgent(a.id))} />
    );
  }

  return view.kind === 'chat' ? (
    <AgentChatView agent={agent} micState={micState} onBack={() => setView(backToList())} />
  ) : (
    <AgentAvatarView agent={agent} micState={micState} />
  );
}
```

- [ ] **Step 9.2: Full gates**

Run: `npx tsc -b && npm run lint && npm test`
Expected: all clean. Pay attention to react-hooks lint output — the Compiler ruleset is strict about the effect deps above; fix exactly what it names, do not disable rules.

- [ ] **Step 9.3: Commit**

```bash
git add src/apps/agents/AgentsApp.tsx
git commit -m "feat: wire agents views (vertical swipe chat⇅avatar, mock mic cycling)"
```

---

### Task 10: Portraits + grid tile

**Files:**
- Create: `public/agents/<id>.png` × 15
- Create: `public/agents-thumb.svg`
- Modify: `src/core/components/AppGrid.tsx:8-35` (tile entry + column slot)

- [ ] **Step 10.1: Generate the 15 portraits (nano-banana skill)**

Invoke the `nano-banana` skill. One image per agent id (`main, chat, health, selfhelp, builder, jobsearcher, gardener, artist, financeer, speaker, knowledge, design-business, dating-coach, filmmaker, lifeos`), prompt template:

> Flat illustration portrait of a friendly AI assistant character, "<NAME>" — <ROLE HINT: e.g. Lifey = warm generalist life copilot; Dr. O'Body = health doctor with stethoscope; Artist = paint-splattered creative; Financeer = sharp accountant with ledger; Gardener = plant-loving; Film Maker = clapperboard; …>. Head-and-shoulders, centered, circular-crop friendly composition, soft muted palette (deep navy background #101418, 2-3 accent colors), consistent style across a set, no text, no watermark.

Output: 512×512 PNG at `public/agents/<id>.png` (downscale with `sips -Z 512` if the generator returns larger). All 15 must share one visual family — generate them in a single batch session so the style holds.

- [ ] **Step 10.2: Grid tile**

```xml
<!-- public/agents-thumb.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="100" fill="#101418"/>
  <circle cx="70" cy="85" r="30" fill="#3dadff" opacity="0.9"/>
  <circle cx="130" cy="85" r="30" fill="#66d575" opacity="0.9"/>
  <circle cx="100" cy="135" r="30" fill="#ff9e42" opacity="0.9"/>
  <text x="100" y="182" text-anchor="middle" font-family="Inter, sans-serif"
        font-size="22" font-weight="600" fill="#e8e8e8">Agents</text>
</svg>
```

In `src/core/components/AppGrid.tsx`, append to `appFaces`:

```ts
  { id: 'agents',          src: '/agents-thumb.svg' },
```

and add `appFaces[14]` into the last column so the tile is reachable:

```ts
  [appFaces[3], appFaces[12], appFaces[13], appFaces[14]], // Magnetic Liquid, GitHub, Claude Usage, Agents
```

- [ ] **Step 10.3: Commit**

```bash
git add public/agents public/agents-thumb.svg src/core/components/AppGrid.tsx
git commit -m "feat: agent portraits (generated set) + app grid tile"
```

---

### Task 11: Full verification (gates + 1080×1080 preview)

**Files:** none (verification only)

- [ ] **Step 11.1: All gates**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 11.2: Preview walkthrough**

Start the dev server via the preview tools (`preview_start` with the launch.json config, port 5180 — never via Bash) and resize the viewport to 1080×1080. The preview tab is backgrounded: timers/animations are throttled, so drive navigation via `window.__nav` where taps are awkward, and remember `finishTransition()` if a transition wedges (known preview gotcha).

Verify each acceptance criterion from the spec:

1. Agents tile appears in the app grid; tapping it opens the list.
2. List shows the agents with portraits (or initial-fallback discs), previews, unread dots on `main` and `health`; `main` (Lifey) is pinned first; list scrolls with top/bottom fades, no bezel clipping.
3. Tap Lifey → chat: header portrait+name, bubbles left/right, "● listening…", state ring visible. Tap header → back to list.
4. In chat, vertical swipe → avatar (fullscreen portrait, name, status); swipe again → chat. Ring cycles idle → listening → thinking → speaking every 4s (foreground the tab or temporarily shorten the interval to observe — throttled background tabs will not animate).
5. Leave the app (swipe horizontally); confirm gestures still work everywhere (callback cleared). Return; confirm list state.
6. Screenshot the list, chat, and avatar views for the report.

- [ ] **Step 11.3: Cross-browser sanity**

Open the same preview URL checks in Chrome AND Safari (mask-image and conic-gradient both need the `-webkit-` prefixed fallbacks that Tasks 1/6/7 include — Safari is the one that breaks). If Safari cannot be driven from this session, say plainly in the report that Safari is unverified.

- [ ] **Step 11.4: Final commit if verification forced fixes**

```bash
git add -A && git commit -m "fix: preview-verification fixes for agents app"
```

(Skip if nothing changed.)

---

## Self-review notes

- **Spec coverage:** list (T5), chat (T7), avatar (T8), state ring (T6), provider seam (T2), registration+schema (T4), portraits (T10), nav invariants (T9), RoundList (T1), acceptance criteria (T11). Direction C stays unbuilt by design.
- **Consistency check done:** `MicState`/`MIC_STATES` names match across T6/T8/T9; `AgentsView` transitions match T3's tested functions; `config` keys match the T4 schema.
- **Known deviation from the RoundList spec:** its testing section imagined render tests; this repo has no DOM test stack, and unilaterally adding @testing-library is out of scope. RoundList's behavior is covered by preview verification (T11), and its logic surface is nil. Flag in the PR description.
