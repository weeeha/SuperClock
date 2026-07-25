import { describe, it, expect } from 'vitest';
import { openAgent, backToList, onVerticalSwipe, type AgentsView } from './view-state';

describe('agents view state', () => {
  it('opening an agent goes to chat', () => {
    expect(openAgent('main')).toEqual({ kind: 'chat', agentId: 'main' });
  });

  it('back returns to list from anywhere', () => {
    expect(backToList()).toEqual({ kind: 'list' });
  });

  it('vertical swipe toggles chat ⇅ avatar (direction-agnostic)', () => {
    const chat: AgentsView = { kind: 'chat', agentId: 'main' };
    const avatar: AgentsView = { kind: 'avatar', agentId: 'main' };
    expect(onVerticalSwipe(chat)).toEqual(avatar);
    expect(onVerticalSwipe(avatar)).toEqual(chat);
    expect(onVerticalSwipe(onVerticalSwipe(chat))).toEqual(chat);
  });

  it('vertical swipe on the list is a no-op (shell keeps swipe-down → grid)', () => {
    const list: AgentsView = { kind: 'list' };
    expect(onVerticalSwipe(list)).toEqual(list);
  });
});
