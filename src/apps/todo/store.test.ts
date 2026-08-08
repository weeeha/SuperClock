import { describe, it, expect } from 'vitest';
import { createLocalTodoStore, STORAGE_KEY, type TodoItem } from './store';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

const item: TodoItem = {
  id: '01ARZ3',
  title: 'water the plants',
  done: false,
  createdAt: 1000,
  doneAt: null,
};

describe('createLocalTodoStore', () => {
  it('round-trips items through the namespaced key', async () => {
    const storage = fakeStorage();
    const store = createLocalTodoStore(storage);
    await store.save([item]);
    expect(Object.keys(storage.dump())).toEqual([STORAGE_KEY]);
    expect(await store.load()).toEqual([item]);
  });

  it('returns [] when nothing is stored', async () => {
    expect(await createLocalTodoStore(fakeStorage()).load()).toEqual([]);
  });

  it('returns [] for malformed JSON instead of throwing', async () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{not json' });
    expect(await createLocalTodoStore(storage).load()).toEqual([]);
  });

  it('returns [] for a wrong-shape payload instead of throwing', async () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 1, items: [{ id: 1 }] }) });
    expect(await createLocalTodoStore(storage).load()).toEqual([]);
  });

  it('rejects a foreign version envelope', async () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 2, items: [item] }) });
    expect(await createLocalTodoStore(storage).load()).toEqual([]);
  });
});
