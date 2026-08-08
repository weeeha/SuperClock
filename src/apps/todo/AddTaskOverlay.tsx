import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '../../core/navigation';
import MiniKeyboard from './MiniKeyboard';

const MAX_TITLE = 80;

export default function AddTaskOverlay({
  onSave,
  onCancel,
}: {
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState('');
  const setBackCallback = useNavigation((s) => s.setBackCallback);

  // System back (left-arc rim swipe) dismisses the overlay — same guarded
  // ownership contract as the vertical-swipe slot (CalendarApp reference).
  // Registered ONCE per mount, calling through a ref: registering writes to
  // the same store this tree reads, which forces a consistency re-render —
  // if the effect also depended on the parent's per-render callback identity,
  // that write→re-render→re-register cycle recurses until React aborts
  // ("maximum update depth exceeded", found in preview, invisible to the
  // component test because the crash needs the full shell's store traffic).
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });
  useEffect(() => {
    const cb = () => onCancelRef.current();
    setBackCallback(cb);
    return () => {
      if (useNavigation.getState().backCallback === cb) setBackCallback(null);
    };
  }, [setBackCallback]);

  return (
    <div className="absolute inset-0 z-20 bg-black flex flex-col items-center pt-32">
      <h2 className="text-3xl font-semibold">New task</h2>
      <div className="mt-8 mb-8 w-[560px] min-h-[72px] px-6 py-4 rounded-2xl bg-neutral-900 text-2xl flex items-center">
        <span className="truncate">{draft}</span>
        <span className="ml-0.5 animate-pulse">|</span>
      </div>
      <MiniKeyboard
        onKey={(ch) => setDraft((d) => (d.length < MAX_TITLE ? d + ch : d))}
        onBackspace={() => setDraft((d) => d.slice(0, -1))}
      />
      <div className="flex gap-8 mt-10">
        <button
          className="px-10 py-3 rounded-full bg-neutral-900 text-neutral-300 text-xl active:bg-neutral-800"
          onClick={onCancel}
        >
          cancel
        </button>
        <button
          className="px-10 py-3 rounded-full bg-white text-black text-xl font-semibold active:bg-neutral-300"
          onClick={() => onSave(draft)}
        >
          save
        </button>
      </div>
    </div>
  );
}
