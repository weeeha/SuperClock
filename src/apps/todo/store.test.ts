import { describe, it, expect } from 'vitest';
import { createTodoStore, TODO_STORAGE_KEY, type TodoItem } from './store';

function fakeStorage(initial?: Record<string, string>) {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

const item: TodoItem = {
  id: '01J000000000000000000000',
  title: 'water the plants',
  done: false,
  createdAt: 1754000000000,
  doneAt: null,
};

describe('todo store', () => {
  it('loads [] when nothing is stored', async () => {
    expect(await createTodoStore(fakeStorage()).load()).toEqual([]);
  });

  it('round-trips items through save/load', async () => {
    const storage = fakeStorage();
    const store = createTodoStore(storage);
    const items = [item, { ...item, id: 'b', done: true, doneAt: 1754000001000 }];
    await store.save(items);
    expect(await store.load()).toEqual(items);
  });

  it('rejects malformed JSON with [] instead of crashing', async () => {
    const storage = fakeStorage({ [TODO_STORAGE_KEY]: '{not json' });
    expect(await createTodoStore(storage).load()).toEqual([]);
  });

  it('rejects a wrong-shape payload with [] and leaves the stored bytes alone', async () => {
    const raw = JSON.stringify([{ id: 42, nope: true }]);
    const storage = fakeStorage({ [TODO_STORAGE_KEY]: raw });
    expect(await createTodoStore(storage).load()).toEqual([]);
    expect(storage.map.get(TODO_STORAGE_KEY)).toBe(raw);
  });

  it('rejects a non-array payload with []', async () => {
    const storage = fakeStorage({ [TODO_STORAGE_KEY]: JSON.stringify({ items: [item] }) });
    expect(await createTodoStore(storage).load()).toEqual([]);
  });
});
