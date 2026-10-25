import { describe, it, expect } from 'vitest';
import { sampleCurvilinear } from './curvilinearSurface';

const TAU = 2 * Math.PI;

const positionsOf = (p: Float32Array, valid: boolean[]) => {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < valid.length; i++) if (valid[i]) out.push([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
  return out;
};

describe('sampleCurvilinear', () => {
  it('rho = 2 is a sphere of radius 2, fully triangulated', () => {
    const res = sampleCurvilinear({ form: 'spherical-rho', expr: '2', uDomain: [0, Math.PI], vDomain: [0, TAU] }, 10);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { positions, valid, indices, valueMin, valueMax } = res.mesh;
    expect(valid).toHaveLength(11 * 11);
    for (const [x, y, z] of positionsOf(positions, valid)) expect(Math.hypot(x, y, z)).toBeCloseTo(2, 5);
    expect(indices).toHaveLength(10 * 10 * 6);
    expect(valueMin).toBe(2);
    expect(valueMax).toBe(2);
  });

  it('r = 2 over azimuth and z is a cylinder wall spanning the z domain', () => {
    const res = sampleCurvilinear({ form: 'cylindrical-r', expr: '2', uDomain: [0, TAU], vDomain: [-1, 3] }, 8);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const pts = positionsOf(res.mesh.positions, res.mesh.valid);
    for (const [x, y] of pts) expect(Math.hypot(x, y)).toBeCloseTo(2, 5);
    expect(Math.min(...pts.map((p) => p[2]))).toBeCloseTo(-1);
    expect(Math.max(...pts.map((p) => p[2]))).toBeCloseTo(3);
  });

  it('z = f(r, azimuth) is a height map over a disc', () => {
    const res = sampleCurvilinear({ form: 'cylindrical-z', expr: 'r', uDomain: [0, 2], vDomain: [0, TAU] }, 8);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    for (const [x, y, z] of positionsOf(res.mesh.positions, res.mesh.valid)) {
      expect(z).toBeCloseTo(Math.hypot(x, y), 5); // a cone
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(2 + 1e-6);
    }
  });

  it('colours by the solved value: z for height maps, r for walls, rho for spheres', () => {
    const res = sampleCurvilinear({ form: 'spherical-rho', expr: '1 + polar', uDomain: [0, Math.PI], vDomain: [0, TAU] }, 4);
    expect(res.ok && res.mesh.valueMin).toBeCloseTo(1);
    expect(res.ok && res.mesh.valueMax).toBeCloseTo(1 + Math.PI);
  });

  it('drops triangles touching non-finite samples instead of failing the surface', () => {
    const res = sampleCurvilinear(
      { form: 'spherical-rho', expr: '1 / sin(polar)', uDomain: [0, Math.PI], vDomain: [0, TAU] },
      10,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Both poles (polar = 0 and π, the first and last u-columns) blow up — at π only to 8e15, as
    // sin(π) isn't exactly 0 — so the two bands of triangles touching them go.
    expect(res.mesh.valid.filter((v) => !v)).toHaveLength(2 * 11);
    expect(res.mesh.indices).toHaveLength((10 - 2) * 10 * 6);
  });

  it('treats complex results (sqrt of a negative) as non-finite', () => {
    const res = sampleCurvilinear({ form: 'cylindrical-z', expr: 'sqrt(1 - r^2)', uDomain: [0, 2], vDomain: [0, TAU] }, 4);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.mesh.valid.some((v) => !v)).toBe(true);
    expect(res.mesh.valid.some((v) => v)).toBe(true);
  });

  it('fails when nothing is finite, or the expression does not parse', () => {
    expect(sampleCurvilinear({ form: 'cylindrical-z', expr: 'sqrt(-1 - r)', uDomain: [0, 1], vDomain: [0, 1] }, 4).ok).toBe(false);
    expect(sampleCurvilinear({ form: 'cylindrical-z', expr: 'r +', uDomain: [0, 1], vDomain: [0, 1] }, 4).ok).toBe(false);
  });

  it('wire overlay follows coordinate lines and skips invalid samples', () => {
    const res = sampleCurvilinear({ form: 'spherical-rho', expr: '1', uDomain: [0, Math.PI], vDomain: [0, TAU] }, 24);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const w = res.mesh.wire;
    expect(w.length % 6).toBe(0); // LineSegments: pairs of xyz
    expect(w.length).toBeGreaterThan(0);
    for (let i = 0; i < w.length; i += 3) expect(Math.hypot(w[i], w[i + 1], w[i + 2])).toBeCloseTo(1, 5);
  });
});
