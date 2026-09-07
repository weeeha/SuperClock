// Run-length codec for the 20x20 Clawd sprite frames.
//
// Stored as 400 integer literals per frame, 216 frames came to 86,400
// numbers and 181 KB of source for art whose runs are long and repetitive.
//
// A run is one letter naming the palette index (a=0, b=1, ... z=25) followed
// by its length in decimal digits, with the length omitted when it is 1.
//
// Letters and digits are deliberately disjoint character classes, and that is
// the whole reason the format works. A first attempt wrote the index in base
// 36, so an index could also be a digit: [0,1,0,1,2] encoded to "01012",
// which reads back as index 0 with a run of 1012. Nothing separates the end
// of one run's count from the start of the next run's index unless the two
// alphabets cannot overlap. A letter always starts a run; digits never do.
//
// The largest palette in the table holds 10 colours; the format has room for
// 26.

const RUN = /([a-z])(\d*)/g;
const A = 'a'.charCodeAt(0);

export function encodeCells(cells: number[]): string {
  let out = '';
  let run = 1;
  for (let i = 1; i <= cells.length; i++) {
    if (i < cells.length && cells[i] === cells[i - 1]) {
      run++;
      continue;
    }
    out += String.fromCharCode(A + cells[i - 1]) + (run > 1 ? String(run) : '');
    run = 1;
  }
  return out;
}

export function decodeCells(rle: string): number[] {
  const cells: number[] = [];
  let consumed = 0;
  RUN.lastIndex = 0;
  for (let m = RUN.exec(rle); m !== null; m = RUN.exec(rle)) {
    // A match that does not start where the last one ended means the string
    // holds a character the format does not define. Bail rather than skip it:
    // silently dropping a byte paints a subtly wrong sprite forever.
    if (m.index !== consumed) break;
    consumed = RUN.lastIndex;
    const value = m[1].charCodeAt(0) - A;
    const count = m[2] === '' ? 1 : Number(m[2]);
    for (let i = 0; i < count; i++) cells.push(value);
  }
  if (consumed !== rle.length) {
    throw new Error(
      `malformed sprite RLE at index ${consumed}: ${rle.slice(consumed, consumed + 12)}`,
    );
  }
  return cells;
}
