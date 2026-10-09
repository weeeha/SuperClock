import { Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigation } from '../navigation';
import { getApp } from '../registry';
import { useActiveInstance } from '../device-config';
import { AppErrorBoundary, ShellGuard } from './AppErrorBoundary';

// After the shell guard remounts the slot there is no exiting child left to
// call onExitComplete, so release a stranded transition here.
function releaseTransition() {
  const nav = useNavigation.getState();
  if (nav.mode === 'transitioning') nav.finishTransition();
}

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

  if (!app) return null;

  const AppComponent = app.component;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <ShellGuard onRecover={releaseTransition}>
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
            key={activeInstanceId ?? activeAppId}
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
              <AppErrorBoundary appId={activeAppId} appName={app.metadata.name}>
                <AppComponent isActive={mode !== 'grid'} config={instance?.config} />
              </AppErrorBoundary>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </ShellGuard>
    </div>
  );
}
