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
