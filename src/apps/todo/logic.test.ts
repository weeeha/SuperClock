import { describe, it, expect } from 'vitest';
import type { TodoItem } from './store';
import { activeItems, doneItems, addItem, toggleItem, clearDone, pruneDone } from './logic';

function mk(id: string, over: Partial<TodoItem> = {}): TodoItem {
  return { id, title: `task ${id}`, done: false, createdAt: 0, doneAt: null, ...over };
}

describe('todo logic', () => {
  it('activeItems: incomplete only, oldest first', () => {
    const items = [
      mk('b', { createdAt: 2 }),
      mk('a', { createdAt: 1 }),
      mk('c', { done: true, doneAt: 9 }),
    ];
    expect(activeItems(items).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('doneItems: completed only, newest done first', () => {
    const items = [mk('a', { done: true, doneAt: 1 }), mk('b', { done: true, doneAt: 5 }), mk('c')];
    expect(doneItems(items).map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('addItem trims the title and appends', () => {
    const next = addItem([], 'id1', '  buy hdmi cable  ', 42);
    expect(next).toEqual([
      { id: 'id1', title: 'buy hdmi cable', done: false, createdAt: 42, doneAt: null },
    ]);
  });

  it('addItem is a no-op for empty and whitespace titles', () => {
    const items = [mk('a')];
    expect(addItem(items, 'x', '   ', 1)).toBe(items);
    expect(addItem(items, 'x', '', 1)).toBe(items);
  });

  it('toggleItem completes with a doneAt stamp and uncompletes back to null', () => {
    const once = toggleItem([mk('a')], 'a', 7);
    expect(once[0]).toMatchObject({ done: true, doneAt: 7 });
    const twice = toggleItem(once, 'a', 9);
    expect(twice[0]).toMatchObject({ done: false, doneAt: null });
  });

  it('clearDone removes only completed items', () => {
    const items = [mk('a'), mk('b', { done: true, doneAt: 1 })];
    expect(clearDone(items).map((i) => i.id)).toEqual(['a']);
  });

  it('pruneDone drops the oldest completed beyond the cap, never active items', () => {
    const items = [
      mk('active1'),
      mk('old', { done: true, doneAt: 1 }),
      mk('mid', { done: true, doneAt: 2 }),
      mk('new', { done: true, doneAt: 3 }),
    ];
    const pruned = pruneDone(items, 2);
    expect(pruned.map((i) => i.id).sort()).toEqual(['active1', 'mid', 'new']);
    expect(pruneDone(items, 3)).toBe(items);
  });
});
