import { useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigation } from './core/navigation';
import { useAppGestures } from './core/hooks/useGestures';
import { usePlaylistAutoRotate } from './core/playlist';
import { useApplySettings } from './core/apply-settings';
import SwipeContainer from './core/components/SwipeContainer';
import AppGrid from './core/components/AppGrid';
import { startConfigPolling, stopConfigPolling } from './shared/local-config';

// Register all apps
import './apps';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initApps = useNavigation((s) => s.initApps);
  const mode = useNavigation((s) => s.mode);

  useEffect(() => {
    initApps();
  }, [initApps]);

  useEffect(() => {
    startConfigPolling();
    return () => stopConfigPolling();
  }, []);

  useAppGestures(containerRef);
  usePlaylistAutoRotate();
  useApplySettings();

  return (
    <div ref={containerRef} className="h-screen w-screen overflow-hidden bg-black">
      <SwipeContainer />
      <AnimatePresence>
        {mode === 'grid' && <AppGrid />}
      </AnimatePresence>
      <div
        id="gesture-debug"
        className="fixed top-1 right-1 z-[9999] rounded bg-black/70 px-2 py-1 font-mono text-xs text-white pointer-events-none"
      >
        ready
      </div>
    </div>
  );
}
