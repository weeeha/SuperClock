// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { render, cleanup, act, screen, waitFor, fireEvent } from '@testing-library/react';
import { lazy, useEffect, useState } from 'react';
import { MotionGlobalConfig } from 'framer-motion';
import SwipeContainer from './SwipeContainer';
import { registerApp } from '../registry';
import { useNavigation } from '../navigation';
import type { AppProps } from '../types';

vi.mock('../device-config', () => ({ useActiveInstance: () => undefined }));

// The shell under test is the real SwipeContainer with the real nav store;
// only the apps are fakes. Each failure mode the boundary has to survive is
// one app.

function Steady() {
  return <p>steady app</p>;
}

let throwsOnMount = true;
function ThrowsInRender(): React.ReactNode {
  if (throwsOnMount) throw new Error('render failed');
  return <p>render app recovered</p>;
}

// The 2026-10-09 shape: a cleanup that throws as the app is torn down.
function ThrowsOnUnmount() {
  useEffect(() => () => {
    throw new Error('cleanup failed on unmount');
  }, []);
  return <p>unmount app</p>;
}

// A cleanup that throws when its effect re-runs, while the app stays live.
function ThrowsOnRerun() {
  const [n, setN] = useState(0);
  useEffect(() => () => {
    throw new Error(`cleanup failed on re-run ${n}`);
  }, [n]);
  return <button onClick={() => setN(n + 1)}>bump</button>;
}

function app(id: string, name: string, component: React.ComponentType<AppProps>) {
  registerApp({
    metadata: { id, name, icon: '', description: '', category: 'utility' },
    component: lazy(() => Promise.resolve({ default: component })),
  });
}

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  app('steady', 'Steady', Steady);
  app('throws-render', 'Throws In Render', ThrowsInRender);
  app('throws-unmount', 'Throws On Unmount', ThrowsOnUnmount);
  app('throws-rerun', 'Throws On Rerun', ThrowsOnRerun);
});

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  throwsOnMount = true;
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  consoleError.mockRestore();
  useNavigation.setState({ mode: 'app', activeAppId: '', activeInstanceId: null, transitionDirection: null });
});

function mountShellOn(appId: string) {
  useNavigation.setState({ mode: 'app', activeAppId: appId, activeInstanceId: null });
  return render(<SwipeContainer />);
}

function crashLogs(): string[] {
  return consoleError.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.startsWith('[app-crash]'));
}

describe('app error boundary', () => {
  it('shows the tell on the app that threw in render, logs its id, and resets on return', async () => {
    const { container } = mountShellOn('throws-render');

    const tell = await screen.findByRole('alert');
    expect(tell.textContent).toContain('Throws In Render');
    expect(tell.textContent).toContain('Something went wrong');
    expect(crashLogs()).toContain('[app-crash] throws-render');

    // Swipe away: the shell still navigates.
    act(() => useNavigation.getState().switchToApp('steady'));
    await screen.findByText('steady app');
    await waitFor(() => expect(useNavigation.getState().mode).toBe('app'));

    // Navigate back once the fault is gone: a fresh boundary, not the old tell.
    throwsOnMount = false;
    act(() => useNavigation.getState().switchToApp('throws-render'));
    await screen.findByText('render app recovered');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.textContent).not.toBe('');
  });

  it('survives a cleanup that throws while the app is swiped away', async () => {
    const { container } = mountShellOn('throws-unmount');
    await screen.findByText('unmount app');

    act(() => useNavigation.getState().switchToApp('steady'));

    await screen.findByText('steady app');
    await waitFor(() => expect(crashLogs().some((m) => m.includes('escaped its slot'))).toBe(true));
    expect(screen.queryByText('unmount app')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useNavigation.getState().mode).toBe('app');
    expect(container.textContent).toContain('steady app');
  });

  it('shows the tell when a live app throws from an effect cleanup on re-run', async () => {
    mountShellOn('throws-rerun');
    fireEvent.click(await screen.findByText('bump'));

    const tell = await screen.findByRole('alert');
    expect(tell.textContent).toContain('Throws On Rerun');
    expect(crashLogs()).toContain('[app-crash] throws-rerun');
  });
});
