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
