// The caffeine complication's cup, drawn.
//
// Both Complications faces set it as `☕`, which put a full-colour system glyph
// inside a tile whose other two rows are white and grey text. It also rendered
// differently on every platform the face was viewed from, and it was the last
// emoji in src/apps/clock.
//
// Drawn at one weight in `currentColor`, so it takes the tile's ink like the
// count beneath it. Sized to the box the glyph occupied (fontSize 62, centred
// on the origin) so neither face's layout moves.
//
// Shared rather than inlined twice: the two faces are near-duplicates already,
// and a second copy of a path is a second thing to keep in step.
export default function CaffeineMark() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
      {/* Cup: straight shoulders, tapered base, so it reads as a cup and not a
          bucket at the ~50px it ships at. */}
      <path d="M -18 -12 L 15 -12 L 12 12 Q 11 19 4 19 L -11 19 Q -17 19 -18 12 Z" />
      {/* Handle, sized off the cup's right wall rather than a round number so
          it stays attached if the body is ever retuned. */}
      <path d="M 15 -5 Q 26 -5 26 3 Q 26 11 14 11" />
      {/* Two strokes of steam, offset from each other — a symmetrical pair
          reads as an arrow. */}
      <path d="M -9 -22 Q -6 -27 -9 -32" />
      <path d="M 2 -22 Q 5 -27 2 -32" />
    </g>
  );
}
