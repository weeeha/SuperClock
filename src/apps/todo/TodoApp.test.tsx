// @vitest-environment jsdom
//
// Behaviour-level coverage for the kiosk Todo app. Everything is driven the
// way the shell drives it: props in, the vertical-swipe callback out. The
// module-scope `createTodoStore(localStorage)` inside TodoApp is why storage
// is installed from vite.config.ts setupFiles rather than a beforeAll here.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import TodoApp from './TodoApp';
import { TODO_STORAGE_KEY, type TodoItem } from './store';
import { useNavigation } from '../../core/navigation';

afterEach(cleanup);

function item(over: Partial<TodoItem> & { id: string }): TodoItem {
  return { title: over.id, done: false, createdAt: 0, doneAt: null, ...over };
}

const SEED: TodoItem[] = [
  item({ id: 'older', title: 'buy milk', createdAt: 100 }),
  item({ id: 'newer', title: 'call mum', createdAt: 200 }),
  item({ id: 'done-old', title: 'wash car', done: true, createdAt: 50, doneAt: 300 }),
  item({ id: 'done-new', title: 'pay rent', done: true, createdAt: 60, doneAt: 400 }),
];

function seed(items: TodoItem[]) {
  localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(items));
}

function stored(): TodoItem[] {
  return JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) ?? '[]') as TodoItem[];
}

// The store's load() is a resolved promise, so one flush settles the app.
async function renderApp(config?: Record<string, unknown>) {
  const view = render(<TodoApp isActive config={config} />);
  await act(async () => {});
  return view;
}

function swipe(dir: 'up' | 'down') {
  const cb = useNavigation.getState().verticalSwipeCallback;
  expect(cb).toBeTruthy();
  act(() => cb!(dir));
}

beforeEach(() => {
  localStorage.clear();
  useNavigation.setState({ verticalSwipeCallback: null, mode: 'app' });
});

describe('TodoApp', () => {
  it('lists active items oldest first and ignores completed ones', async () => {
    seed(SEED);
    await renderApp();
    const rows = screen.getAllByText(/buy milk|call mum|wash car/);
    expect(rows.map((r) => r.textContent)).toEqual(['buy milk', 'call mum']);
    expect(screen.getByText('2 open')).toBeTruthy();
  });

  it('shows the required empty state when nothing is open', async () => {
    await renderApp();
    expect(screen.getByText('All clear — tap + Add to capture something.')).toBeTruthy();
  });

  it('swipe up opens Done newest first, swipe down returns to Active', async () => {
    seed(SEED);
    await renderApp();

    swipe('up');
    expect(screen.getByRole('heading', { name: 'Done' })).toBeTruthy();
    const done = screen.getAllByText(/wash car|pay rent/);
    expect(done.map((r) => r.textContent)).toEqual(['pay rent', 'wash car']);

    swipe('down');
    expect(screen.getByRole('heading', { name: 'Todo' })).toBeTruthy();
  });

  it('swipe down while on Active falls through to the app grid', async () => {
    await renderApp();
    swipe('down');
    expect(useNavigation.getState().mode).not.toBe('app');
  });

  it('tapping a row completes it and persists the change', async () => {
    seed(SEED);
    await renderApp();

    await act(async () => {
      fireEvent.click(screen.getByText('buy milk'));
    });

    expect(screen.queryByText('buy milk')).toBeNull();
    expect(screen.getByText('1 open')).toBeTruthy();
    expect(stored().find((i) => i.id === 'older')?.done).toBe(true);
  });

  it('clear all needs a second tap, then empties Done and persists', async () => {
    seed(SEED);
    await renderApp();
    swipe('up');

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByText('pay rent')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tap again to clear' }));
    });

    expect(screen.getByText('Nothing completed yet.')).toBeTruthy();
    expect(stored().map((i) => i.id)).toEqual(['older', 'newer']);
  });

  it('the clear-all arm state never survives a view switch', async () => {
    seed(SEED);
    await renderApp();
    swipe('up');

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    swipe('down');
    swipe('up');

    expect(screen.getByRole('button', { name: 'Clear all' })).toBeTruthy();
  });

  it('showCompleted=false makes swipe up a no-op and hides the pager dots', async () => {
    seed(SEED);
    const { container } = await renderApp({ showCompleted: false });

    swipe('up');
    expect(screen.getByRole('heading', { name: 'Todo' })).toBeTruthy();
    expect(container.querySelectorAll('.rounded-full.w-1\\.5').length).toBe(0);
  });

  // The trap documented in CLAUDE.md: SwipeContainer's popLayout keeps the
  // exiting app mounted after the next app has registered, so an unconditional
  // null in cleanup stomps the incoming app's callback.
  it('unmount does not stomp a successor registration', async () => {
    const { unmount } = await renderApp();
    const successor = () => {};
    useNavigation.setState({ verticalSwipeCallback: successor });

    unmount();

    expect(useNavigation.getState().verticalSwipeCallback).toBe(successor);
  });
});
