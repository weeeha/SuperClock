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
  // swipe-down → grid keeps working. In-app view changes never touch nav mode.
  useEffect(() => {
    if (!isActive || view.kind === 'list') {
      setVerticalSwipeCallback(null);
      return;
    }
    setVerticalSwipeCallback(() => setView((v) => onVerticalSwipe(v)));
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

  // Backgrounded apps stay mounted (grid overlay only deactivates them) — hand
  // the views the static 'idle' ring so no CSS animation runs while inactive.
  const shownMicState: MicState = isActive ? micState : 'idle';

  const agent =
    view.kind === 'list' ? undefined : visible.find((a) => a.id === view.agentId);

  // Viewed agent vanished (disabled via config mid-view): snap back to the
  // list during render so the swipe effect re-runs and releases the vertical
  // swipe slot — otherwise swipe-down-to-grid stays dead on the fallback.
  if (view.kind !== 'list' && agents.length > 0 && !agent) {
    setView(backToList());
  }

  if (view.kind === 'list' || !agent) {
    return (
      <AgentListView agents={visible} onSelect={(a) => setView(openAgent(a.id))} />
    );
  }

  return view.kind === 'chat' ? (
    <AgentChatView
      agent={agent}
      micState={shownMicState}
      onBack={() => setView(backToList())}
    />
  ) : (
    <AgentAvatarView agent={agent} micState={shownMicState} />
  );
}
