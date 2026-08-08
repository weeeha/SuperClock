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

async function renderApp() {
  const utils = render(<TodoApp isActive />);
  await act(async () => {});
  return utils;
}

function tapKeys(text: string) {
  for (const ch of text) {
    fireEvent.click(screen.getByRole('button', { name: ch === ' ' ? 'space' : ch }));
  }
}

beforeEach(() => {
  window.localStorage.clear();
  useNavigation.getState().setVerticalSwipeCallback(null);
  useNavigation.getState().setBackCallback(null);
});

describe('AddTaskOverlay', () => {
  it('opens from + add a task, types via keys, saves the item', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('+ add a task'));
    expect(screen.getByText('New task')).toBeTruthy();
    tapKeys('buy hdmi');
    fireEvent.click(screen.getByText('save'));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.items.map((i: TodoItem) => i.title)).toEqual(['buy hdmi']);
    expect(screen.queryByText('New task')).toBeNull(); // overlay closed
    expect(screen.getByText('buy hdmi')).toBeTruthy(); // row visible
  });

  it('backspace edits the draft', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('+ add a task'));
    tapKeys('ab');
    fireEvent.click(screen.getByRole('button', { name: 'backspace' }));
    fireEvent.click(screen.getByText('save'));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.items[0].title).toBe('a');
  });

  it('cancel discards the draft and saves nothing', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('+ add a task'));
    tapKeys('zz');
    fireEvent.click(screen.getByText('cancel'));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByText('New task')).toBeNull();
  });

  it('save with an empty draft keeps the overlay open and stores nothing', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('+ add a task'));
    fireEvent.click(screen.getByText('save'));
    expect(screen.getByText('New task')).toBeTruthy();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('registers the system back gesture to close, with guarded cleanup', async () => {
    await renderApp();
    expect(useNavigation.getState().backCallback).toBeNull();
    fireEvent.click(screen.getByText('+ add a task'));
    expect(useNavigation.getState().backCallback).not.toBeNull();
    act(() => {
      useNavigation.getState().backCallback?.();
    });
    expect(screen.queryByText('New task')).toBeNull();
    expect(useNavigation.getState().backCallback).toBeNull();
  });

  it('back registration is stable across parent re-renders (no re-register loop)', async () => {
    // Registering writes to the store the tree reads from, which forces a
    // consistency re-render — if the overlay re-registered per parent render,
    // that recursion crashed the whole kiosk tree in the real shell
    // ("maximum update depth exceeded"). Pin the mount-once contract.
    const utils = render(<TodoApp isActive config={{ maxItems: 200 }} />);
    await act(async () => {});
    fireEvent.click(screen.getByText('+ add a task'));
    const registered = useNavigation.getState().backCallback;
    expect(registered).not.toBeNull();
    utils.rerender(<TodoApp isActive config={{ maxItems: 200 }} />);
    await act(async () => {});
    expect(useNavigation.getState().backCallback).toBe(registered);
  });
});
