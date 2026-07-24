// Intermediate version — chat/avatar views and isActive wiring land in
// Tasks 6–9; this version only renders the list.
import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import { mockAgentProvider, type Agent } from './provider';
import { openAgent, type AgentsView } from './view-state';
import AgentListView from './AgentListView';

export default function AgentsApp({ config }: AppProps) {
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

  const visible = useMemo(() => {
    const rawEnabled = config?.enabledAgents;
    const enabledAgents = Array.isArray(rawEnabled)
      ? rawEnabled.filter((x): x is string => typeof x === 'string')
      : [];
    const defaultAgent =
      typeof config?.defaultAgent === 'string' ? config.defaultAgent : 'main';
    const filtered =
      enabledAgents.length > 0
        ? agents.filter((a) => enabledAgents.includes(a.id))
        : agents;
    // defaultAgent pinned to the top; provider order otherwise (stable sort).
    return [...filtered].sort((a, b) =>
      a.id === defaultAgent ? -1 : b.id === defaultAgent ? 1 : 0,
    );
  }, [agents, config]);

  if (view.kind === 'list') {
    return (
      <AgentListView agents={visible} onSelect={(a) => setView(openAgent(a.id))} />
    );
  }
  // chat/avatar arrive in Tasks 7–9; until then any non-list view shows nothing.
  return null;
}
