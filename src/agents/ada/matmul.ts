// Pure matrix-multiply helpers, extracted for testability (no Solid/DOM involved).
//
// Deliberately does NOT accept a pre-computed result from the caller: an LLM asked to
// hand-multiply matrices in JSON will sometimes get the arithmetic wrong, so the product
// is always computed here from the raw `a`/`b` inputs, eliminating that failure mode.

export type MatmulResult =
  | { ok: true; c: number[][] }
  | { ok: false; error: string };

const isRectangular = (m: number[][]): boolean =>
  m.length > 0 && m.every((row) => row.length === m[0].length);

export function multiplyMatrices(a: number[][], b: number[][]): MatmulResult {
  if (!isRectangular(a) || a.some((row) => row.length === 0)) {
    return { ok: false, error: 'Matrix A is empty or has rows of unequal length.' };
  }
  if (!isRectangular(b) || b.some((row) => row.length === 0)) {
    return { ok: false, error: 'Matrix B is empty or has rows of unequal length.' };
  }

  const aRows = a.length;
  const aCols = a[0].length;
  const bRows = b.length;
  const bCols = b[0].length;

  if (aCols !== bRows) {
    return {
      ok: false,
      error: `Cannot multiply: A is ${aRows}×${aCols}, B is ${bRows}×${bCols} — A's column count must equal B's row count.`,
    };
  }

  const c: number[][] = [];
  for (let i = 0; i < aRows; i++) {
    const row: number[] = [];
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i][k] * b[k][j];
      }
      row.push(sum);
    }
    c.push(row);
  }

  return { ok: true, c };
}
