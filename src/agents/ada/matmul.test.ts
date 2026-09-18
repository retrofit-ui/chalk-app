import { describe, it, expect } from 'vitest';
import { multiplyMatrices } from './matmul';

describe('multiplyMatrices', () => {
  it('computes the correct product for a valid multiply', () => {
    const result = multiplyMatrices(
      [[2, 3], [1, 0]],
      [[1, 4], [4, 2]],
    );
    expect(result).toEqual({
      ok: true,
      c: [
        [2 * 1 + 3 * 4, 2 * 4 + 3 * 2],
        [1 * 1 + 0 * 4, 1 * 4 + 0 * 2],
      ],
    });
  });

  it('handles the degenerate 1x1 case', () => {
    const result = multiplyMatrices([[5]], [[3]]);
    expect(result).toEqual({ ok: true, c: [[15]] });
  });

  it('returns an error when inner dimensions do not match', () => {
    const result = multiplyMatrices(
      [[1, 2, 3], [4, 5, 6]],
      [[1, 2], [3, 4]],
    );
    expect(result).toEqual({
      ok: false,
      error: "Cannot multiply: A is 2×3, B is 2×2 — A's column count must equal B's row count.",
    });
  });

  it('returns an error for an empty matrix A', () => {
    const result = multiplyMatrices([], [[1]]);
    expect(result.ok).toBe(false);
  });

  it('returns an error for a ragged matrix B', () => {
    const result = multiplyMatrices(
      [[1, 2]],
      [[1, 2], [3]],
    );
    expect(result.ok).toBe(false);
  });
});
