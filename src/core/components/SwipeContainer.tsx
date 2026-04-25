import { Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigation } from '../navigation';
import { getApp } from '../registry';

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
  const { activeAppId, transitionDirection, finishTransition } = useNavigation();
  const app = getApp(activeAppId);

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
        <motion.div
          key={activeAppId}
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
            <AppComponent isActive={true} />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
