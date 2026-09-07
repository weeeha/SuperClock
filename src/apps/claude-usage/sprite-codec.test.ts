import { describe, expect, it } from 'vitest';
import { decodeCells, encodeCells } from './sprite-codec';

describe('sprite cell codec', () => {
  it('round-trips a run of one value', () => {
    expect(decodeCells(encodeCells([0, 0, 0]))).toEqual([0, 0, 0]);
  });

  // The case that killed the first format. With a base-36 index, [0,1,0,1,2]
  // encoded to "01012" and read back as index 0 with a run of 1012, because
  // nothing told the decoder where one run's count ended and the next run's
  // index began. Letters and digits being disjoint is what fixes it.
  it('round-trips alternating single cells without swallowing the next index', () => {
    const cells = [0, 1, 0, 1, 2];
    expect(encodeCells(cells)).toBe('ababc');
    expect(decodeCells(encodeCells(cells))).toEqual(cells);
  });

  it('encodes a single cell without a run length', () => {
    expect(encodeCells([5])).toBe('f');
  });

  it('encodes a run as the palette letter then its length', () => {
    expect(encodeCells([0, 0, 0, 0])).toBe('a4');
  });

  it('keeps a palette index above 9 to one character', () => {
    expect(encodeCells([10, 10])).toBe('k2');
  });

  it('round-trips a multi-digit run adjacent to another run', () => {
    const cells = [...Array<number>(120).fill(0), ...Array<number>(3).fill(1), 2];
    expect(encodeCells(cells)).toBe('a120b3c');
    expect(decodeCells(encodeCells(cells))).toEqual(cells);
  });

  it('round-trips an empty frame', () => {
    expect(decodeCells(encodeCells([]))).toEqual([]);
  });

  it('rejects a string starting with a digit', () => {
    expect(() => decodeCells('99z')).toThrow(/malformed sprite RLE/);
  });

  it('rejects a stray character mid-string', () => {
    expect(() => decodeCells('a4-b2')).toThrow(/malformed sprite RLE/);
  });
});
