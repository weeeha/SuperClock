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

/** Chat ⇅ avatar toggle. Direction-agnostic by design (wireframe: "both
 *  ways" swipe the same), so the function takes no direction. On the list
 *  it's a no-op — vertical swipes stay unclaimed there so the shell's
 *  default (swipe-down opens the grid) keeps working. */
export function onVerticalSwipe(view: AgentsView): AgentsView {
  if (view.kind === 'chat') return { kind: 'avatar', agentId: view.agentId };
  if (view.kind === 'avatar') return { kind: 'chat', agentId: view.agentId };
  return view;
}
