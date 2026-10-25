import { describe, it, expect } from 'vitest';
import {
  cartesianToPolar,
  cylindricalBasis,
  cylindricalToCartesian,
  expressionSymbols,
  formatAngle,
  formatClickPoint,
  niceStep,
  spokeLabelPoint,
  parseAngle,
  polarBasis,
  polarGrid,
  polarToCartesian,
  sphericalBasis,
  sphericalToCartesian,
} from './coords';

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

describe('charts', () => {
  it('polar round-trips through cartesian, with theta normalised to [0, 2π)', () => {
    close(polarToCartesian(2, Math.PI / 2), [0, 2]);
    const p = cartesianToPolar(-1, -1);
    expect(p.r).toBeCloseTo(Math.SQRT2);
    expect(p.theta).toBeCloseTo((5 * Math.PI) / 4);
    expect(cartesianToPolar(0, -3).theta).toBeCloseTo((3 * Math.PI) / 2);
  });

  it('cylindrical keeps z and maps (r, azimuth) like polar', () => {
    close(cylindricalToCartesian(2, Math.PI, 5), [-2, 0, 5]);
  });

  it('spherical uses polar from +z and azimuth from +x', () => {
    close(sphericalToCartesian(3, 0, 1.234), [0, 0, 3]);
    close(sphericalToCartesian(2, Math.PI / 2, Math.PI / 2), [0, 2, 0]);
  });
});

describe('local bases', () => {
  it('polar basis is orthonormal and r̂ points away from the origin', () => {
    const { rHat, thetaHat } = polarBasis(Math.PI / 3);
    expect(dot(rHat, rHat)).toBeCloseTo(1);
    expect(dot(rHat, thetaHat)).toBeCloseTo(0);
    close(rHat, [0.5, Math.sqrt(3) / 2]);
    // θ̂ is r̂ rotated +90°, the direction of increasing θ.
    close(thetaHat, [-Math.sqrt(3) / 2, 0.5]);
  });

  it('cylindrical basis is right-handed', () => {
    const { rHat, azimuthHat, zHat } = cylindricalBasis(0.7);
    const cross = [
      rHat[1] * azimuthHat[2] - rHat[2] * azimuthHat[1],
      rHat[2] * azimuthHat[0] - rHat[0] * azimuthHat[2],
      rHat[0] * azimuthHat[1] - rHat[1] * azimuthHat[0],
    ];
    close(cross, zHat);
  });

  it('spherical basis is orthonormal and right-handed (r̂ × θ̂ = φ̂)', () => {
    const { rhoHat, polarHat, azimuthHat } = sphericalBasis(1.1, 2.3);
    for (const [a, b] of [[rhoHat, polarHat], [rhoHat, azimuthHat], [polarHat, azimuthHat]]) {
      expect(dot(a, b)).toBeCloseTo(0);
    }
    const cross = [
      rhoHat[1] * polarHat[2] - rhoHat[2] * polarHat[1],
      rhoHat[2] * polarHat[0] - rhoHat[0] * polarHat[2],
      rhoHat[0] * polarHat[1] - rhoHat[1] * polarHat[0],
    ];
    close(cross, azimuthHat);
    close(rhoHat, sphericalToCartesian(1, 1.1, 2.3));
  });
});

describe('parseAngle', () => {
  it('reads numbers in the spec unit', () => {
    expect(parseAngle(Math.PI, 'radians')).toEqual({ ok: true, value: Math.PI });
    const deg = parseAngle(90, 'degrees');
    expect(deg.ok && deg.value).toBeCloseTo(Math.PI / 2);
  });

  it('evaluates expression strings, and unit strings regardless of the spec unit', () => {
    const a = parseAngle('3*pi/4', 'radians');
    expect(a.ok && a.value).toBeCloseTo((3 * Math.PI) / 4);
    const b = parseAngle('30 deg', 'radians');
    expect(b.ok && b.value).toBeCloseTo(Math.PI / 6);
    const c = parseAngle('45', 'degrees');
    expect(c.ok && c.value).toBeCloseTo(Math.PI / 4);
  });

  it('rejects junk with a message', () => {
    expect(parseAngle('pi/', 'radians').ok).toBe(false);
    expect(parseAngle('x + 1', 'radians').ok).toBe(false);
    expect(parseAngle(null, 'radians').ok).toBe(false);
    expect(parseAngle(Number.NaN, 'radians').ok).toBe(false);
  });

  it('refuses pi in degrees mode unless a unit is given', () => {
    const a = parseAngle('pi/6', 'degrees');
    expect(a.ok).toBe(false);
    expect(!a.ok && a.error).toContain('in degrees');
    const b = parseAngle('30 deg', 'degrees');
    expect(b.ok && b.value).toBeCloseTo(Math.PI / 6);
  });
});

describe('formatAngle', () => {
  it('snaps to π fractions in radians', () => {
    expect(formatAngle(0, 'radians')).toBe('0');
    expect(formatAngle(Math.PI / 6, 'radians')).toBe('π/6');
    expect(formatAngle((5 * Math.PI) / 6, 'radians')).toBe('5π/6');
    expect(formatAngle(Math.PI, 'radians')).toBe('π');
    expect(formatAngle(Math.PI / 2 + 0.003, 'radians')).toBe('π/2');
    expect(formatAngle((7 * Math.PI) / 4, 'radians')).toBe('7π/4');
    expect(formatAngle(1, 'radians')).toBe('1');
    expect(formatAngle(1.2345, 'radians')).toBe('1.23');
  });

  it('prints degrees with a degree sign', () => {
    expect(formatAngle(Math.PI / 6, 'degrees')).toBe('30°');
    expect(formatAngle(1, 'degrees')).toBe('57.3°');
  });
});

describe('formatClickPoint', () => {
  it('prints cartesian points as before', () => {
    expect(formatClickPoint({ x: 1.5, y: 2 })).toBe('(1.5, 2)');
  });

  it('prints polar first with the cartesian equivalent', () => {
    expect(formatClickPoint({ x: 1.5, y: 2.6, polar: { r: 3, theta: Math.PI / 3, angleUnit: 'radians' } })).toBe(
      '(r = 3, θ = π/3) ≈ (1.5, 2.6)',
    );
    expect(formatClickPoint({ x: 0, y: 2, polar: { r: 2, theta: Math.PI / 2, angleUnit: 'degrees' } })).toBe(
      '(r = 2, θ = 90°) ≈ (0, 2)',
    );
  });
});

describe('polar grid', () => {
  it('picks 1/2/5 steps', () => {
    expect(niceStep(5)).toBe(1);
    expect(niceStep(12)).toBe(2);
    expect(niceStep(0.9)).toBe(0.2);
    expect(niceStep(40)).toBe(10);
  });

  it('rings reach the farthest visible corner and spokes are every π/6', () => {
    const g = polarGrid([-3, 3], [-4, 4]);
    expect(g.rMax).toBeCloseTo(5);
    expect(g.rings[0]).toBe(g.step);
    expect(g.rings[g.rings.length - 1]).toBeGreaterThanOrEqual(5);
    expect(g.spokes).toHaveLength(12);
    expect(g.spokes[1]).toBeCloseTo(Math.PI / 6);
  });
});

describe('expressionSymbols', () => {
  it('lists free variables, not function names', () => {
    const s = expressionSymbols('sin(2*theta) + r^2 * cos(pi)');
    expect(s.ok && [...s.symbols].sort()).toEqual(['pi', 'r', 'theta']);
  });

  it('reports parse errors', () => {
    expect(expressionSymbols('sin(').ok).toBe(false);
  });
});

describe('spokeLabelPoint', () => {
  it('puts labels on the inset border of the view, along the spoke', () => {
    const at = (deg: number) => spokeLabelPoint((deg * Math.PI) / 180, [-4, 4], [-3, 3], 0.5)!;
    close(at(0), [3.5, 0]);
    close(at(90), [0, 2.5]);
    close(at(180), [-3.5, 0]);
    const diag = at(45); // hits the top edge first (2.5 < 3.5)
    expect(diag[1]).toBeCloseTo(2.5);
    expect(diag[0]).toBeCloseTo(2.5);
  });

  it('gives up when the origin is out of view', () => {
    expect(spokeLabelPoint(0, [1, 5], [-3, 3], 0.5)).toBeNull();
  });
});
