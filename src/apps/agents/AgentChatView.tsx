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
