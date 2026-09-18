import { describe, it, expect } from 'vitest';
import { sampleSurface } from './surfaceSampler';

describe('sampleSurface', () => {
  it('samples a known bowl function on a small grid with the expected shape and extrema', () => {
    const result = sampleSurface('x^2 + y^2', [-1, 1], [-1, 1], 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { xs, ys, zs, zMin, zMax } = result.surface;
    // (resolution + 1)^2 = 3x3 grid
    expect(xs).toHaveLength(9);
    expect(ys).toHaveLength(9);
    expect(zs).toHaveLength(9);
    expect(zMin).toBeCloseTo(0); // at (0, 0)
    expect(zMax).toBeCloseTo(2); // at the four corners, e.g. (1, 1)
    // spot-check a specific grid point: (x=0, y=-1) -> z = 1
    const idx = xs.findIndex((x, i) => Math.abs(x) < 1e-9 && Math.abs(ys[i] + 1) < 1e-9);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(zs[idx]).toBeCloseTo(1);
  });

  it('clamps resolution to the documented max of 80 rather than erroring', () => {
    const result = sampleSurface('x + y', [-1, 1], [-1, 1], 200);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.surface.xs).toHaveLength(81 * 81);
  });

  it('clamps resolution up to at least 1 for a non-positive input', () => {
    const result = sampleSurface('x + y', [-1, 1], [-1, 1], 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.surface.xs).toHaveLength(4); // (1+1) x (1+1)
  });

  it('returns an error result (does not throw) for an unparsable expression', () => {
    expect(() => sampleSurface('x +', [-1, 1], [-1, 1], 4)).not.toThrow();
    const result = sampleSurface('x +', [-1, 1], [-1, 1], 4);
    expect(result.ok).toBe(false);
  });

  it('returns an error result (does not throw) when evaluation yields a non-finite value', () => {
    const result = sampleSurface('1 / x', [-1, 1], [-1, 1], 2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/non-finite/);
  });
});
