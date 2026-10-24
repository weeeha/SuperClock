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
    <div className="w-full h-full bg-(--face-bg) text-(--face-ink) pt-24 pb-16">
      <RoundList
        items={agents}
        onSelect={onSelect}
        header={
          <h1 className="text-4xl font-semibold text-center mb-6">Agents</h1>
        }
        empty={
          <p className="text-(--face-ink-muted) text-center mt-24">
            No agents enabled — check enabledAgents in the admin.
          </p>
        }
        renderItem={(a) => (
          <div className="h-full flex items-center gap-5 px-4 rounded-3xl active:bg-(--face-plate)">
            <AgentPortrait name={a.name} src={a.portrait} size={56} />
            <div className="flex-1 min-w-0">
              <div className="text-2xl font-semibold leading-tight">{a.name}</div>
              <div className="text-base text-(--face-ink-muted) truncate">
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
