// Samples a surface written in cylindrical or spherical coordinates: one coordinate as a
// mathjs expression of the other two, over a (u, v) grid, pushed through the chart to
// cartesian. Pure (no three.js), like surfaceSampler.ts.
//
// Unlike sampleSurface (z = f(x, y)), one non-finite sample doesn't fail the surface:
// curvilinear surfaces routinely blow up on an axis or at a pole (1/sin(polar)), so the
// triangles touching it are dropped and the rest is drawn. Only an all-non-finite surface
// fails. Floating-point poles rarely come out as Infinity (1/sin(π) is 8e15), so a value
// beyond MAX_MAGNITUDE counts as non-finite too; left in, it would be a spike off-screen
// that also flattens the colour scale.

import { compile } from 'mathjs';
import { clampResolution } from './surfaceSampler';
import { cylindricalToCartesian, sphericalToCartesian, type V2, type V3 } from './coords';

export type CurvilinearForm =
  /** z = f(r, azimuth): u = r, v = azimuth */
  | 'cylindrical-z'
  /** r = f(azimuth, z): u = azimuth, v = z */
  | 'cylindrical-r'
  /** rho = f(polar, azimuth): u = polar, v = azimuth */
  | 'spherical-rho';

export type CurvilinearSurfaceInput = { form: CurvilinearForm; expr: string; uDomain: V2; vDomain: V2 };

/** The expression's two variable names, in (u, v) order. */
export const FORM_VARIABLES: Record<CurvilinearForm, [string, string]> = {
  'cylindrical-z': ['r', 'azimuth'],
  'cylindrical-r': ['azimuth', 'z'],
  'spherical-rho': ['polar', 'azimuth'],
};

const toCartesian: Record<CurvilinearForm, (u: number, v: number, value: number) => V3> = {
  'cylindrical-z': (r, azimuth, z) => cylindricalToCartesian(r, azimuth, z),
  'cylindrical-r': (azimuth, z, r) => cylindricalToCartesian(r, azimuth, z),
  'spherical-rho': (polar, azimuth, rho) => sphericalToCartesian(rho, polar, azimuth),
};

export type CurvilinearMesh = {
  /** (n+1)² vertices; u varies fastest: idx = i + (n+1)*j for u-step i, v-step j. */
  positions: Float32Array;
  /** The solved coordinate at each vertex (z, r or rho); NaN where non-finite. */
  values: number[];
  valid: boolean[];
  /** Triangle indices over valid vertices only. */
  indices: number[];
  valueMin: number;
  valueMax: number;
  /** Coordinate-line overlay as LineSegments pairs (x1,y1,z1,x2,y2,z2,…). */
  wire: number[];
};

export type CurvilinearResult = { ok: true; mesh: CurvilinearMesh } | { ok: false; error: string };

const WIRE_LINES = 12;
const MAX_MAGNITUDE = 1e6;

export function sampleCurvilinear(input: CurvilinearSurfaceInput, resolution: number): CurvilinearResult {
  const n = clampResolution(resolution);
  const [uName, vName] = FORM_VARIABLES[input.form];
  let compiled: { evaluate: (scope: Record<string, number>) => unknown };
  try {
    compiled = compile(input.expr);
  } catch (err) {
    return { ok: false, error: `Failed to parse surface expression "${input.expr}": ${(err as Error).message}` };
  }

  const count = (n + 1) * (n + 1);
  const positions = new Float32Array(count * 3);
  const values: number[] = new Array(count);
  const valid: boolean[] = new Array(count);
  let valueMin = Infinity;
  let valueMax = -Infinity;
  const [u0, u1] = input.uDomain;
  const [v0, v1] = input.vDomain;

  try {
    for (let j = 0; j <= n; j++) {
      const v = v0 + ((v1 - v0) * j) / n;
      for (let i = 0; i <= n; i++) {
        const u = u0 + ((u1 - u0) * i) / n;
        const idx = i + (n + 1) * j;
        const value = compiled.evaluate({ [uName]: u, [vName]: v });
        const ok = typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_MAGNITUDE;
        valid[idx] = ok;
        values[idx] = ok ? (value as number) : Number.NaN;
        if (!ok) continue;
        const [x, y, z] = toCartesian[input.form](u, v, value as number);
        positions.set([x, y, z], idx * 3);
        if ((value as number) < valueMin) valueMin = value as number;
        if ((value as number) > valueMax) valueMax = value as number;
      }
    }
  } catch (err) {
    return { ok: false, error: `Failed to evaluate surface expression "${input.expr}": ${(err as Error).message}` };
  }

  if (valueMin === Infinity) {
    return { ok: false, error: `Surface expression "${input.expr}" is not finite anywhere on its domain.` };
  }

  const indices: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = i + (n + 1) * j;
      const b = a + 1;
      const c = a + (n + 1);
      const d = c + 1;
      if (valid[a] && valid[b] && valid[c]) indices.push(a, b, c);
      if (valid[b] && valid[d] && valid[c]) indices.push(b, d, c);
    }
  }

  // Constant-u and constant-v lines, every `stride` samples, broken at invalid vertices.
  const stride = Math.max(1, Math.round(n / WIRE_LINES));
  const wire: number[] = [];
  const segment = (p: number, q: number) => {
    if (!valid[p] || !valid[q]) return;
    wire.push(positions[p * 3], positions[p * 3 + 1], positions[p * 3 + 2], positions[q * 3], positions[q * 3 + 1], positions[q * 3 + 2]);
  };
  for (let j = 0; j <= n; j += stride) for (let i = 0; i < n; i++) segment(i + (n + 1) * j, i + 1 + (n + 1) * j);
  for (let i = 0; i <= n; i += stride) for (let j = 0; j < n; j++) segment(i + (n + 1) * j, i + (n + 1) * (j + 1));

  return { ok: true, mesh: { positions, values, valid, indices, valueMin, valueMax, wire } };
}
