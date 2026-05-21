import { motion } from 'framer-motion';

export default function SettingsPanel() {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
    >
      <div className="flex flex-col items-center gap-3 text-white">
        <div className="font-display text-3xl tracking-wide">Settings</div>
        <div className="text-sm text-white/50">Swipe down to dismiss</div>
      </div>
    </motion.div>
  );
}
