import type { ChalkMatrixCellNote } from './spec';

// Pure helper, extracted for testability: builds a "row,col" -> note lookup.
// Later entries win on duplicate row/col pairs.
export const cellNoteKey = (row: number, col: number): string => `${row},${col}`;

export const buildCellNoteLookup = (
  cellNotes: ChalkMatrixCellNote[] | undefined,
): Map<string, ChalkMatrixCellNote> => {
  const lookup = new Map<string, ChalkMatrixCellNote>();
  if (!cellNotes) return lookup;
  for (const cellNote of cellNotes) {
    lookup.set(cellNoteKey(cellNote.row, cellNote.col), cellNote);
  }
  return lookup;
};
