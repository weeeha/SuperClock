interface BackChevronProps {
  label?: string;
  onBack: () => void;
}

/** Top-of-circle back affordance. Absolutely positioned in the circle's top cap. */
export default function BackChevron({ label = 'back', onBack }: BackChevronProps) {
  return (
    <button
      onClick={onBack}
      className="absolute top-[7%] left-1/2 -translate-x-1/2 flex items-center gap-[1vmin]
                 text-white/50 text-[3.4vmin] font-medium bg-transparent border-0"
      aria-label="Back"
    >
      <span className="text-[4vmin] leading-none">&lsaquo;</span>
      {label}
    </button>
  );
}
