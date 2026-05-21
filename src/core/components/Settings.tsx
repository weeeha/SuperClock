import { motion } from 'framer-motion';
import { useNavigation } from '../navigation';

export default function Settings() {
  const { mode, hideSettings } = useNavigation();

  if (mode !== 'settings') return null;

  return (
    <motion.div
      className="absolute inset-0 z-50 overflow-hidden bg-black/95 backdrop-blur"
      initial={{ y: '-100%' }}
      animate={{ y: 0 }}
      exit={{ y: '-100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 text-white">
        <div className="text-2xl font-semibold">Settings</div>
        <div className="text-sm opacity-60">Swipe up to dismiss</div>
        <button
          onClick={hideSettings}
          className="rounded-full border border-white/30 px-6 py-2 text-sm active:scale-95 transition-transform"
        >
          Close
        </button>
      </div>
    </motion.div>
  );
}
