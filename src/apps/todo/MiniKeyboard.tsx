// Deliberately minimal on-screen keyboard — the fleet's Chromium/labwc has no
// OS keyboard, so the app draws its own. A placeholder until voice capture
// lands (per the 2026-07-21 spec); lowercase + digits only, no layers.
const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export default function MiniKeyboard({
  onKey,
  onBackspace,
}: {
  onKey: (ch: string) => void;
  onBackspace: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {ROWS.map((row) => (
        <div key={row} className="flex gap-2">
          {[...row].map((ch) => (
            <button
              key={ch}
              aria-label={ch}
              className="w-16 h-16 rounded-xl bg-neutral-900 text-white text-2xl active:bg-neutral-700"
              onClick={() => onKey(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-2">
        <button
          aria-label="space"
          className="w-[22rem] h-16 rounded-xl bg-neutral-900 active:bg-neutral-700"
          onClick={() => onKey(' ')}
        />
        <button
          aria-label="backspace"
          className="w-24 h-16 rounded-xl bg-neutral-900 text-white text-2xl active:bg-neutral-700"
          onClick={onBackspace}
        >
          {'⌫'}
        </button>
      </div>
    </div>
  );
}
