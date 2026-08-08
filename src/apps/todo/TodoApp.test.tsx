// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import TodoApp from './TodoApp';
import { STORAGE_KEY, type TodoItem } from './store';
import { installMemoryLocalStorage } from './test-storage';
import { useNavigation } from '../../core/navigation';

// Vitest runs without globals, so testing-library cannot self-register its
// afterEach cleanup — every jsdom test file does this explicitly.
afterEach(cleanup);

beforeAll(installMemoryLocalStorage);

function seed(items: TodoItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, items }));
}

const ITEMS: TodoItem[] = [
  { id: 'a', title: 'water the plants', done: false, createdAt: 1, doneAt: null },
  { id: 'b', title: 'book dentist', done: false, createdAt: 2, doneAt: null },
  { id: 'c', title: 'deploy night mode', done: true, createdAt: 0, doneAt: 5 },
];

// The store's load() is async — flush the pending promise before asserting.
async function renderApp(config?: Record<string, unknown>) {
  const utils = render(<TodoApp isActive config={config} />);
  await act(async () => {});
  return utils;
}

function swipe(dir: 'up' | 'down') {
  act(() => {
    useNavigation.getState().verticalSwipeCallback?.(dir);
  });
}

beforeEach(() => {
  window.localStorage.clear();
  useNavigation.getState().setVerticalSwipeCallback(null);
  // mode leaks across tests (showGrid in one test would make a later
  // mode assertion vacuous) — pin it back to app mode.
  useNavigation.setState({ mode: 'app' });
});

describe('TodoApp', () => {
  it('loads and lists active items oldest-first', async () => {
    seed(ITEMS);
    await renderApp();
    const rows = screen.getAllByTestId('todo-row').map((r) => r.textContent);
    expect(rows[0]).toContain('water the plants');
    expect(rows[1]).toContain('book dentist');
    expect(screen.queryByText('deploy night mode')).toBeNull();
  });

  it('swipe up shows Done (newest first), swipe down returns to Active', async () => {
    seed(ITEMS);
    const { container } = await renderApp();
    swipe('up');
    expect(container.querySelector('[data-view="done"]')).toBeTruthy();
    expect(screen.getByText('deploy night mode')).toBeTruthy();
    swipe('down');
    expect(container.querySelector('[data-view="active"]')).toBeTruthy();
  });

  it('swipe down at Active opens the grid (shell convention)', async () => {
    seed(ITEMS);
    await renderApp();
    swipe('down');
    expect(useNavigation.getState().mode).toBe('grid');
  });

  it('tap toggles an item done and persists it', async () => {
    seed(ITEMS);
    await renderApp();
    fireEvent.click(screen.getByText('water the plants'));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    const a = stored.items.find((i: TodoItem) => i.id === 'a');
    expect(a.done).toBe(true);
    expect(typeof a.doneAt).toBe('number');
  });

  it('clear all on Done removes completed items and persists', async () => {
    seed(ITEMS);
    await renderApp();
    swipe('up');
    fireEvent.click(screen.getByText('clear all'));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.items.map((i: TodoItem) => i.id)).toEqual(['a', 'b']);
  });

  it('showCompleted=false hides Done: swipe up is a no-op, dots hidden', async () => {
    seed(ITEMS);
    const { container } = await renderApp({ showCompleted: false });
    swipe('up');
    expect(container.querySelector('[data-view="active"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="pager-dots"]')).toBeNull();
    swipe('down');
    expect(useNavigation.getState().mode).toBe('grid');
  });

  it('empty Active shows the required empty state', async () => {
    await renderApp();
    expect(screen.getByText(/All clear/)).toBeTruthy();
  });

  it('guarded cleanup: unmount does not stomp a successor registration', async () => {
    seed(ITEMS);
    const { unmount } = await renderApp();
    const successor = () => {};
    act(() => {
      useNavigation.getState().setVerticalSwipeCallback(successor);
    });
    unmount();
    expect(useNavigation.getState().verticalSwipeCallback).toBe(successor);
  });
});
