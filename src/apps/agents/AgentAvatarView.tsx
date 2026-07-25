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

// Deliberately self-contained (agent + micState in, nothing else) so it can
// later mount as a playlist "presence" face — parked direction C in the spec.
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
