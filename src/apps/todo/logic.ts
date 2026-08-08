// Pure list operations — no storage, no React. The component wires these to
// TodoStore.save on every mutation; ids are minted by the caller (ulid).
import type { TodoItem } from './store';

export function activeItems(items: TodoItem[]): TodoItem[] {
  return items.filter((i) => !i.done).sort((a, b) => a.createdAt - b.createdAt);
}

export function doneItems(items: TodoItem[]): TodoItem[] {
  return items.filter((i) => i.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
}

export function addItem(items: TodoItem[], id: string, title: string, now: number): TodoItem[] {
  const trimmed = title.trim();
  if (!trimmed) return items;
  return [...items, { id, title: trimmed, done: false, createdAt: now, doneAt: null }];
}

export function toggleItem(items: TodoItem[], id: string, now: number): TodoItem[] {
  return items.map((i) => (i.id === id ? { ...i, done: !i.done, doneAt: i.done ? null : now } : i));
}

export function clearDone(items: TodoItem[]): TodoItem[] {
  return items.filter((i) => !i.done);
}

// maxDone caps the DONE archive only — active tasks are never auto-deleted.
export function pruneDone(items: TodoItem[], maxDone: number): TodoItem[] {
  const done = doneItems(items);
  if (done.length <= maxDone) return items;
  const drop = new Set(done.slice(maxDone).map((i) => i.id));
  return items.filter((i) => !drop.has(i.id));
}
