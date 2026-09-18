import { describe, it, expect } from 'vitest';
import { buildCellNoteLookup, cellNoteKey } from './matrixCellNotes';

describe('buildCellNoteLookup', () => {
  it('returns an empty lookup when cellNotes is undefined', () => {
    expect(buildCellNoteLookup(undefined).size).toBe(0);
  });

  it('keys each note by its row and col so it can be found by cellNoteKey', () => {
    const note = { row: 1, col: 0, formula: 'r_2', note: 'product rule' };
    const lookup = buildCellNoteLookup([note]);
    expect(lookup.get(cellNoteKey(1, 0))).toEqual(note);
    expect(lookup.get(cellNoteKey(0, 1))).toBeUndefined();
  });

  it('lets a later duplicate row/col entry win over an earlier one', () => {
    const first = { row: 0, col: 0, formula: 'a' };
    const second = { row: 0, col: 0, formula: 'b' };
    const lookup = buildCellNoteLookup([first, second]);
    expect(lookup.get(cellNoteKey(0, 0))).toEqual(second);
  });
});
