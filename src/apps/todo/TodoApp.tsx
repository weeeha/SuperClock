import { useCallback, useEffect, useMemo, useState } from 'react';
import { ulid } from 'ulid';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import RoundList from '../../core/widgets/RoundList';
import { todoAppSchema } from '../../shared/schemas/app.todo';
import { createLocalTodoStore, type TodoItem } from './store';
import { activeItems, doneItems, addItem, toggleItem, clearDone, pruneDone } from './logic';
import AddTaskOverlay from './AddTaskOverlay';

function AddTaskButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button
      className={`px-8 py-2 rounded-full border border-dashed border-neutral-700 text-neutral-400 text-xl active:bg-neutral-900 ${className ?? ''}`}
      onClick={onOpen}
    >
      + add a task
    </button>
  );
}

type View = 'active' | 'done';

function Row({ item }: { item: TodoItem }) {
  return (
    <div
      data-testid="todo-row"
      className="h-full flex items-center gap-5 px-6 rounded-3xl active:bg-neutral-900"
    >
      <div
        className={`w-9 h-9 rounded-full border-2 shrink-0 flex items-center justify-center ${
          item.done ? 'border-neutral-600 bg-neutral-700 text-black' : 'border-neutral-500'
        }`}
      >
        {item.done ? '✓' : ''}
      </div>
      <div
        className={`text-2xl leading-tight truncate ${
          item.done ? 'text-neutral-500 line-through' : 'text-white'
        }`}
      >
        {item.title}
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center pt-24 pb-4">
      <h1 className="text-4xl font-semibold">{title}</h1>
      <p className="text-base text-neutral-400 mt-2">{subtitle}</p>
    </div>
  );
}

export default function TodoApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = todoAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : todoAppSchema.parse({});
  }, [config]);

  const store = useMemo(() => createLocalTodoStore(), []);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [view, setView] = useState<View>('active');
  const [adding, setAdding] = useState(false);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  useEffect(() => {
    let alive = true;
    void store.load().then((loaded) => {
      if (alive) setItems(loaded);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  const commit = useCallback(
    (next: TodoItem[]) => {
      const pruned = pruneDone(next, cfg.maxItems);
      setItems(pruned);
      void store.save(pruned);
    },
    [cfg.maxItems, store],
  );

  // Stable identities — the overlay registers the system back gesture on
  // mount, so its props must not churn per render (see AddTaskOverlay).
  const closeAdd = useCallback(() => setAdding(false), []);
  const saveAdd = useCallback(
    (title: string) => {
      const next = addItem(items, ulid(), title, Date.now());
      if (next === items) return; // empty draft — keep the overlay open
      commit(next);
      setAdding(false);
    },
    [items, commit],
  );

  // View switching consumes vertical swipes via the shell's callback slot —
  // HabitsApp is the reference contract, including the guarded cleanup.
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    const cb = (dir: 'up' | 'down') => {
      if (dir === 'up') {
        if (view === 'active' && cfg.showCompleted) setView('done');
      } else if (view === 'done') {
        setView('active');
      } else {
        showGrid(); // swipe down at Active = the shell's default gesture
      }
    };
    setVerticalSwipeCallback(cb);
    return () => {
      // popLayout keeps the exiting app mounted after the next app registers —
      // only clear the slot if it's still ours.
      if (useNavigation.getState().verticalSwipeCallback === cb) setVerticalSwipeCallback(null);
    };
  }, [isActive, view, cfg.showCompleted, setVerticalSwipeCallback, showGrid]);

  const active = activeItems(items);
  const done = doneItems(items);

  return (
    <div data-view={view} className="relative w-full h-full bg-black text-white overflow-hidden">
      {view === 'active' ? (
        <RoundList
          items={active}
          onSelect={(item) => commit(toggleItem(items, item.id, Date.now()))}
          header={
            <div className="flex flex-col items-center">
              <Header title="Todo" subtitle={`${active.length} active · oldest first`} />
              {active.length > 0 && <AddTaskButton onOpen={() => setAdding(true)} className="mb-3" />}
            </div>
          }
          empty={
            <div className="text-center mt-28">
              <p className="text-3xl font-semibold">All clear</p>
              <p className="text-neutral-400 mt-3">nothing active — add a task to get started</p>
              <AddTaskButton onOpen={() => setAdding(true)} className="mt-8" />
            </div>
          }
          renderItem={(item) => <Row item={item} />}
        />
      ) : (
        <RoundList
          items={done}
          onSelect={(item) => commit(toggleItem(items, item.id, Date.now()))}
          header={<Header title="Done" subtitle={`${done.length} completed · newest first`} />}
          footer={
            done.length > 0 ? (
              <button
                className="mx-auto mb-20 mt-2 px-10 py-3 rounded-full bg-neutral-900 text-neutral-300 text-xl active:bg-neutral-800"
                onClick={() => commit(clearDone(items))}
              >
                clear all
              </button>
            ) : undefined
          }
          empty={<p className="text-neutral-400 text-center mt-28">Nothing completed yet</p>}
          renderItem={(item) => <Row item={item} />}
        />
      )}

      {adding && <AddTaskOverlay onCancel={closeAdd} onSave={saveAdd} />}

      {cfg.showCompleted && (
        <div
          data-testid="pager-dots"
          className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none"
        >
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'active' ? 'bg-white' : 'bg-white/25'}`}
          />
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${view === 'done' ? 'bg-white' : 'bg-white/25'}`}
          />
        </div>
      )}
    </div>
  );
}
