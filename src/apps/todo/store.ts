// Device-local todo persistence behind a narrow interface, so the future
// sync layer replaces this implementation without touching the app
// (docs/superpowers/specs/2026-07-21-roundlist-and-todo-design.md).
import { z } from 'zod';

export interface TodoItem {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  doneAt: number | null;
}

export interface TodoStore {
  load(): Promise<TodoItem[]>;
  save(items: TodoItem[]): Promise<void>;
}

const todoItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  done: z.boolean(),
  createdAt: z.number(),
  doneAt: z.number().nullable(),
});

const todoFileSchema = z.array(todoItemSchema);

// Namespaced, unlike the bare `superclock-fitness-count` key this pattern
// corrects. Bump the suffix on breaking shape changes.
export const TODO_STORAGE_KEY = 'superclock:app:todo';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

// storage is injectable so the store round-trips under test without a DOM.
export function createTodoStore(storage: StorageLike): TodoStore {
  return {
    load() {
      let raw: string | null = null;
      try {
        raw = storage.getItem(TODO_STORAGE_KEY);
      } catch {
        return Promise.resolve([]);
      }
      if (raw === null) return Promise.resolve([]);
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        return Promise.resolve([]);
      }
      const parsed = todoFileSchema.safeParse(json);
      // A malformed payload yields an empty list instead of crashing the
      // kiosk on load; the stored bytes stay put until the next save.
      return Promise.resolve(parsed.success ? parsed.data : []);
    },
    save(items) {
      try {
        storage.setItem(TODO_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Quota/private-mode failures lose persistence, never the session.
      }
      return Promise.resolve();
    },
  };
}
