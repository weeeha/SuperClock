import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ulid } from 'ulid';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import RoundList from '../../core/widgets/RoundList';
import { todoAppSchema } from '../../shared/schemas/app.todo';
import { createTodoStore, type TodoItem } from './store';

type View = 'active' | 'done';

const store = createTodoStore(localStorage);
const MAX_TITLE = 60;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const;

const ACCENT = 'var(--color-accent)';

function ActiveRow({ item }: { item: TodoItem }) {
  return (
    <div className="h-full flex items-center gap-6 px-4 rounded-3xl active:bg-neutral-900">
      <div className="w-11 h-11 rounded-full border-[3px] border-neutral-600 shrink-0" />
      <div className="flex-1 min-w-0 text-2xl leading-tight truncate text-white">{item.title}</div>
    </div>
  );
}

function DoneRow({ item }: { item: TodoItem }) {
  return (
    <div className="h-full flex items-center gap-6 px-4 rounded-3xl active:bg-neutral-900">
      <div
        className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-black text-2xl font-bold"
        style={{ background: ACCENT }}
      >
        ✓
      </div>
      <div className="flex-1 min-w-0 text-2xl leading-tight truncate text-neutral-500 line-through">
        {item.title}
      </div>
    </div>
  );
}

// Manual entry is a placeholder until voice capture lands (spec: deliberately
// minimal). The fleet is touch-only with no OS keyboard, so the keys are ours.
function AddOverlay({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  onSave: () => void;
  onCancel: () => void;
}) {
  // Functional updates: rapid taps must append, not clobber each other.
  const type = (ch: string) => {
    setDraft((d) => (d.length < MAX_TITLE ? d + ch : d));
  };
  const key =
    'w-16 h-16 rounded-xl bg-neutral-900 text-white text-2xl active:bg-neutral-700 shrink-0';
  return (
    <div className="absolute inset-0 z-20 bg-black/95 flex flex-col items-center justify-center gap-3">
      <div className="w-[62%] min-h-16 mb-4 px-6 py-3 rounded-2xl bg-neutral-950 border border-neutral-800 text-3xl text-white break-words text-center">
        {draft || <span className="text-neutral-600">new todo…</span>}
      </div>
      {KEY_ROWS.map((row) => (
        <div key={row} className="flex gap-2 justify-center">
          {row.split('').map((ch) => (
            <button key={ch} className={key} onClick={() => type(ch)}>
              {ch}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-2 justify-center mt-1">
        <button className={`${key} w-28`} onClick={onCancel}>
          ✕
        </button>
        <button className={`${key} w-64`} onClick={() => type(' ')}>
          ␣
        </button>
        <button className={`${key} w-28`} onClick={() => setDraft((d) => d.slice(0, -1))}>
          ⌫
        </button>
        <button
          className={`${key} w-28 text-black font-bold disabled:opacity-30`}
          style={{ background: ACCENT }}
          disabled={draft.trim().length === 0}
          onClick={onSave}
        >
          ✓
        </button>
      </div>
    </div>
  );
}

export default function TodoApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = todoAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : todoAppSchema.parse({});
  }, [config]);

  // null = not loaded yet; mutations only happen after load, so a slow load
  // can never overwrite stored items with an empty list.
  const [items, setItems] = useState<TodoItem[] | null>(null);
  const [view, setView] = useState<View>('active');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  useEffect(() => {
    let mounted = true;
    void store.load().then((loaded) => {
      if (mounted) setItems(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // View switching consumes vertical swipes via the shell's callback slot —
  // the HabitsApp tier-2 contract, including the guarded cleanup: popLayout
  // keeps the exiting app mounted after the next app registers, so only
  // clear the slot if it is still ours.
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    const cb = (dir: 'up' | 'down') => {
      if (dir === 'up') {
        if (view === 'active' && cfg.showCompleted) {
          setView('done');
          setConfirmClear(false); // arm state never survives a view switch
        }
      } else if (view === 'done') {
        setView('active');
        setConfirmClear(false);
      } else {
        showGrid(); // swipe down at view 0 = the shell's default gesture
      }
    };
    setVerticalSwipeCallback(cb);
    return () => {
      if (useNavigation.getState().verticalSwipeCallback === cb) setVerticalSwipeCallback(null);
    };
  }, [isActive, view, cfg.showCompleted, setVerticalSwipeCallback, showGrid]);

  const activeItems = useMemo(
    () =>
      (items ?? [])
        .filter((i) => !i.done)
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, cfg.maxItems),
    [items, cfg.maxItems],
  );
  const doneItems = useMemo(
    () =>
      (items ?? [])
        .filter((i) => i.done)
        .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
        .slice(0, cfg.maxItems),
    [items, cfg.maxItems],
  );

  function update(next: TodoItem[]) {
    setItems(next);
    void store.save(next);
  }

  function toggle(item: TodoItem) {
    setConfirmClear(false);
    update(
      (items ?? []).map((i) =>
        i.id === item.id ? { ...i, done: !i.done, doneAt: i.done ? null : Date.now() } : i,
      ),
    );
  }

  function addItem() {
    const title = draft.trim();
    if (!title || items === null) return;
    update([...items, { id: ulid(), title, done: false, createdAt: Date.now(), doneAt: null }]);
    setDraft('');
    setAdding(false);
  }

  function clearDone() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    update((items ?? []).filter((i) => !i.done));
    setConfirmClear(false);
  }

  const loading = items === null;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden text-white">
      {view === 'active' ? (
        <div className="w-full h-full pt-24 pb-16">
          <RoundList
            items={activeItems}
            onSelect={toggle}
            header={
              <div className="text-center mb-4">
                <h1 className="text-4xl font-semibold">Todo</h1>
                <p className="text-neutral-500 text-lg mt-1">
                  {loading ? '…' : `${activeItems.length} open`}
                </p>
                <button
                  className="mt-3 px-10 py-2.5 rounded-full bg-neutral-900 text-xl font-semibold active:bg-neutral-800"
                  style={{ color: ACCENT }}
                  onClick={() => setAdding(true)}
                >
                  + Add
                </button>
              </div>
            }
            empty={
              <p className="text-neutral-400 text-center mt-24">
                {loading ? 'Loading…' : 'All clear — tap + Add to capture something.'}
              </p>
            }
            renderItem={(i) => <ActiveRow item={i} />}
          />
        </div>
      ) : (
        <div className="w-full h-full pt-24 pb-16">
          <RoundList
            items={doneItems}
            onSelect={toggle}
            header={
              <div className="text-center mb-4">
                <h1 className="text-4xl font-semibold">Done</h1>
                <p className="text-neutral-500 text-lg mt-1">{doneItems.length} completed</p>
                <button
                  className="mt-3 px-10 py-2.5 rounded-full bg-neutral-900 text-xl font-semibold active:bg-neutral-800 disabled:opacity-30"
                  style={{ color: confirmClear ? '#ff5555' : ACCENT }}
                  disabled={doneItems.length === 0}
                  onClick={clearDone}
                >
                  {confirmClear ? 'Tap again to clear' : 'Clear all'}
                </button>
              </div>
            }
            empty={<p className="text-neutral-400 text-center mt-24">Nothing completed yet.</p>}
            renderItem={(i) => <DoneRow item={i} />}
          />
        </div>
      )}

      {adding && (
        <AddOverlay
          draft={draft}
          setDraft={setDraft}
          onSave={addItem}
          onCancel={() => {
            // ✕ is stated intent to discard; only app-switching keeps a draft.
            setAdding(false);
            setDraft('');
          }}
        />
      )}

      {cfg.showCompleted && (
        <div className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
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
