import { Suspense, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigation } from '../navigation';
import { getApp } from '../registry';
import { useActiveInstance } from '../device-config';

/** Longer than the exit spring below. A transition still open after this had
 *  no exit to complete (a child that never mounted); finish it rather than
 *  leave every gesture dead, since they all gate on mode. */
export const TRANSITION_WATCHDOG_MS = 1500;

const variants = {
  enter: (direction: 'left' | 'right' | null) => ({
    x: direction === 'left' ? '100%' : '-100%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 'left' | 'right' | null) => ({
    x: direction === 'left' ? '-100%' : '100%',
    opacity: 0,
  }),
};

export default function SwipeContainer() {
  const { activeAppId, activeInstanceId, mode, transitionDirection, finishTransition } =
    useNavigation();
  const app = getApp(activeAppId);
  const instance = useActiveInstance(activeAppId);
  const key = activeInstanceId ?? activeAppId;

  // The transition contract: 'transitioning' is only ever closed by
  // onExitComplete below, so it must only be entered when a child is on
  // screen to exit. Two cases never get that callback and wedged the kiosk
  // with every gesture dead (2026-11-01, a boot with a pinned playlist that
  // switched instance before the first app child mounted): nothing shown yet,
  // or a key that did not change. Finish those at once. A real exit gets a
  // watchdog as well, for a child that never mounts.
  const shownKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const shown = app ? key : null;
    if (mode !== 'transitioning') {
      shownKeyRef.current = shown;
      return;
    }
    if (shownKeyRef.current === null || shownKeyRef.current === shown) {
      shownKeyRef.current = shown;
      finishTransition();
      return;
    }
    const id = setTimeout(() => {
      if (useNavigation.getState().mode === 'transitioning') finishTransition();
    }, TRANSITION_WATCHDOG_MS);
    return () => clearTimeout(id);
  }, [mode, key, app, finishTransition]);

  if (!app) return null;

  const AppComponent = app.component;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnimatePresence
        initial={false}
        custom={transitionDirection}
        mode="popLayout"
        onExitComplete={finishTransition}
      >
        {/* Keyed on the instance when one is active: switching between two
            instances of the same app must still remount/animate, otherwise
            onExitComplete never fires and mode wedges at 'transitioning'. */}
        <motion.div
          key={key}
          custom={transitionDirection}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute inset-0"
        >
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </div>
            }
          >
            {/* Deactivate the app while the grid overlay covers it — apps
                gate their intervals/rAF on isActive, and the fireplace's
                particle sim burning CPU behind an opaque overlay is real
                heat on a Pi. */}
            <AppComponent isActive={mode !== 'grid'} config={instance?.config} />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
