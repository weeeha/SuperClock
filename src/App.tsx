import { useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigation } from './core/navigation';
import { useAppGestures } from './core/hooks/useGestures';
import SwipeContainer from './core/components/SwipeContainer';
import AppGrid from './core/components/AppGrid';

// Register all apps
import './apps';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initApps = useNavigation((s) => s.initApps);
  const mode = useNavigation((s) => s.mode);

  useEffect(() => {
    initApps();
  }, [initApps]);

  useAppGestures(containerRef);

  return (
    <div ref={containerRef} className="h-screen w-screen overflow-hidden bg-black">
      <SwipeContainer />
      <AnimatePresence>
        {mode === 'grid' && <AppGrid />}
      </AnimatePresence>
      <div
        id="gesture-debug"
        className="fixed left-1/2 top-[10%] -translate-x-1/2 z-[9999] rounded bg-fuchsia-600 px-3 py-1 font-mono text-base text-white pointer-events-none"
      >
        ready
      </div>
    </div>
  );
}
