import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// Two boundaries, because React routes a commit-phase error to the nearest
// boundary that is still MOUNTED.
//
// AppErrorBoundary wraps one app slot, inside SwipeContainer's keyed
// motion.div. It catches what a live app throws in render, in a lifecycle
// method, or in an effect and its cleanup when the effect re-runs, and shows
// the tell on that app's own screen. It needs no reset logic: the slot is
// keyed on the instance, so navigating away and back mounts a fresh boundary.
//
// It cannot catch a cleanup that throws while its app is being swiped away:
// the boundary is inside the subtree being deleted, so React skips it and
// unmounts the root (2026-10-09, the ai-face app, an empty body). ShellGuard
// sits above AnimatePresence, survives that deletion, logs, and remounts the
// slot it owns. The app that threw is already gone; the one entering
// remounts once.
//
// Neither catches errors thrown in event handlers, timers or promise
// callbacks. React never sees those.

interface AppErrorBoundaryProps {
  appId: string;
  appName: string;
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[app-crash] ${this.props.appId}`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <AppErrorTell appName={this.props.appName} />;
  }
}

/** The quiet tell on a crashed app's own screen. Static: nothing ticks, nothing
 *  is interactive, so the shell's swipe and arc gestures pass straight through.
 *  Ground and inks are tier 2 roles, so it flips with the day/night palette
 *  (pairs held at 4.5:1 in both modes by token-contrast.test.ts). */
export function AppErrorTell({ appName }: { appName: string }) {
  return (
    <div
      role="alert"
      className="flex h-full w-full flex-col items-center justify-center gap-[1vmin] bg-[hsl(var(--surface-ground))]"
    >
      <span className="text-[3vmin] text-[hsl(var(--ink))]">{appName}</span>
      <span className="text-[2.2vmin] text-[hsl(var(--ink-muted))]">Something went wrong</span>
    </div>
  );
}

// More escapes than this inside the window means remounting is not helping
// (the shell itself throws, not an exiting app), so stop and show a tell
// rather than loop.
const SHELL_RETRY_LIMIT = 3;
const SHELL_RETRY_WINDOW_MS = 10_000;

interface ShellGuardProps {
  children: ReactNode;
  /** Runs after each remount. A remount drops AnimatePresence's exiting child,
   *  so its onExitComplete never fires; this lets the owner release
   *  mode: 'transitioning' itself. */
  onRecover?: () => void;
}

interface ShellGuardState {
  /** Keys the children: bumping it remounts the slot after an escaped error. */
  generation: number;
  /** Timestamps of recent escapes, for the retry limit. */
  escapes: number[];
  failed: boolean;
}

export class ShellGuard extends Component<ShellGuardProps, ShellGuardState> {
  state: ShellGuardState = { generation: 0, escapes: [], failed: false };

  static getDerivedStateFromError(): Partial<ShellGuardState> {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // The source app is already unmounted, so its id is not in props; the
    // component stack names it.
    console.error('[app-crash] escaped its slot (thrown during unmount?)', error, info.componentStack);
    const now = Date.now();
    this.setState((s): ShellGuardState => {
      const escapes = [...s.escapes.filter((t) => now - t < SHELL_RETRY_WINDOW_MS), now];
      if (escapes.length > SHELL_RETRY_LIMIT) return { ...s, escapes, failed: true };
      return { escapes, failed: false, generation: s.generation + 1 };
    });
  }

  componentDidUpdate(_: ShellGuardProps, prev: ShellGuardState) {
    if (this.state.generation !== prev.generation) this.props.onRecover?.();
  }

  render() {
    if (this.state.failed) {
      // Mid-recovery this renders for one commit; past the retry limit it stays.
      return this.state.escapes.length > SHELL_RETRY_LIMIT ? <AppErrorTell appName="SuperClock" /> : null;
    }
    return <ShellGeneration key={this.state.generation}>{this.props.children}</ShellGeneration>;
  }
}

function ShellGeneration({ children }: { children: ReactNode }) {
  return children;
}
