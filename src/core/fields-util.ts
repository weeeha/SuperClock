// Plain values and the one hook shared by Fields-skin screens. The components
// live in src/core/fields.tsx; react-refresh wants component files to export
// components only.

import { useEffect, useRef, useState, type RefObject } from 'react';

/** Centre of the 1080 design frame. */
export const C = 540;

/** Cut a string to `max` characters with an ellipsis. Fields rows are one
 *  line on a round screen; a long title must not run off the disc. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Width of an SVG text node once the bundled fonts have loaded. The first
 *  paint may use a fallback face, so the measure waits for document.fonts. */
export function useTextWidth(text: string): [RefObject<SVGTextElement | null>, number] {
  const ref = useRef<SVGTextElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let live = true;
    const measure = () => {
      const el = ref.current;
      if (live && el && typeof el.getComputedTextLength === 'function') setWidth(el.getComputedTextLength());
    };
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (fonts?.ready) fonts.ready.then(measure);
    else queueMicrotask(measure);
    return () => {
      live = false;
    };
  }, [text]);
  return [ref, width];
}
