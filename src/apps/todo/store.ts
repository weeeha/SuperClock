// Persistence for the Todo app. v1 is device-local: a zod-validated envelope
// under a namespaced localStorage key (the fitness bare-key anti-pattern,
// corrected). The TodoStore interface is the sync seam — a future sync layer
// replaces createLocalTodoStore, not the app.
import { z } from 'zod';

export const todoItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  done: z.boolean(),
  createdAt: z.number(),
  doneAt: z.number().nullable(),
});

export type TodoItem = z.infer<typeof todoItemSchema>;

const envelopeSchema = z.object({
  v: z.literal(1),
  items: z.array(todoItemSchema),
});

export const STORAGE_KEY = 'superclock:app:todo';

export interface TodoStore {
  load(): Promise<TodoItem[]>;
  save(items: TodoItem[]): Promise<void>;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function createLocalTodoStore(storage: StorageLike = localStorage): TodoStore {
  return {
    async load() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = envelopeSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data.items : [];
      } catch {
        return []; // a corrupt payload must never crash the kiosk on load
      }
    },
    async save(items) {
      storage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, items }));
    },
  };
}
