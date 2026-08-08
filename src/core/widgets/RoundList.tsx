// src/core/widgets/RoundList.tsx
//
// Scrolling list for the circular 1080×1080 viewport. Centred column at
// min(62%, 680px) so rows never hit the bezel curve; top/bottom edges
// dissolve via a CSS mask instead of clipping. First consumer: Agents app.
// API pinned by docs/superpowers/specs/2026-07-21-roundlist-and-todo-design.md.
import type { ReactNode } from 'react';

export interface RoundListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onSelect?: (item: T, index: number) => void;
  /** Row height in px. Default 96 — below ~72 the touch target is too small. */
  itemHeight?: number;
  /** Fixed content above the scroll area (title, count). */
  header?: ReactNode;
  /** Fixed content below the scroll area (actions like clear-all). */
  footer?: ReactNode;
  /** Shown when items is empty. Required — an empty list must say why. */
  empty: ReactNode;
}

const FADE = 64;
const MASK = `linear-gradient(to bottom, transparent 0, black ${FADE}px, black calc(100% - ${FADE}px), transparent 100%)`;

export default function RoundList<T>({
  items,
  renderItem,
  onSelect,
  itemHeight = 96,
  header,
  footer,
  empty,
}: RoundListProps<T>) {
  return (
    <div className="w-full h-full flex flex-col items-center">
      {header}
      <div
        data-roundlist-scroll=""
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          width: 'min(62%, 680px)',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          maskImage: MASK,
          WebkitMaskImage: MASK,
        }}
      >
        {items.length === 0
          ? empty
          : items.map((item, i) => (
              <div
                key={i}
                style={{ height: itemHeight }}
                onClick={() => onSelect?.(item, i)}
              >
                {renderItem(item, i)}
              </div>
            ))}
      </div>
      {footer}
    </div>
  );
}
