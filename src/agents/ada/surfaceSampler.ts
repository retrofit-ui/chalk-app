// Pure two-variable expression sampler, extracted for testability (no three.js/Solid involved).
//
// Evaluates a mathjs expression like "(x-1)^2 + 2*(y+0.5)^2" over a rectangular x/y domain,
// producing a flat row-major grid of samples sized (resolution+1) x (resolution+1) — this
// matches the vertex layout of a `THREE.PlaneGeometry(width, height, resolution, resolution)`,
// so the caller can copy `zs[i]` straight onto the position attribute's Z/height component.
//
// Error handling: rather than throwing, this returns a discriminated result (`ok: true/false`),
// matching this repo's existing convention (see matmul.ts's `MatmulResult`). Callers (Scene3D)
// must check `.ok` and skip rendering that surface (with a console.warn) on failure, rather than
// letting a bad expression from the LLM crash the whole scene.

import { compile } from 'mathjs';

export type SampledSurface = {
  // flat arrays sized (resolution+1) x (resolution+1), row-major (y-major, then x), matching how
  // a THREE.PlaneGeometry's vertex grid is laid out.
  xs: number[];
  ys: number[];
  zs: number[];
  zMin: number;
  zMax: number;
};

export type SampleSurfaceResult =
  | { ok: true; surface: SampledSurface }
  | { ok: false; error: string };

const MIN_RESOLUTION = 1;
const MAX_RESOLUTION = 80;

// Exported so callers building a matching THREE.PlaneGeometry (whose segment counts must equal
// the grid this module actually samples) can clamp identically before constructing geometry.
export const clampResolution = (resolution: number): number =>
  Math.max(MIN_RESOLUTION, Math.min(MAX_RESOLUTION, Math.round(resolution)));

export function sampleSurface(
  fn: string,
  xDomain: [number, number],
  yDomain: [number, number],
  resolution: number,
): SampleSurfaceResult {
  const res = clampResolution(resolution);

  let compiled: { evaluate: (scope: Record<string, number>) => unknown };
  try {
    compiled = compile(fn);
  } catch (err) {
    return { ok: false, error: `Failed to parse surface expression "${fn}": ${(err as Error).message}` };
  }

  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  let zMin = Infinity;
  let zMax = -Infinity;

  try {
    for (let j = 0; j <= res; j++) {
      const y = y0 + ((y1 - y0) * j) / res;
      for (let i = 0; i <= res; i++) {
        const x = x0 + ((x1 - x0) * i) / res;
        const z = compiled.evaluate({ x, y });
        if (typeof z !== 'number' || !Number.isFinite(z)) {
          return {
            ok: false,
            error: `Surface expression "${fn}" produced a non-finite value at x=${x}, y=${y}.`,
          };
        }
        xs.push(x);
        ys.push(y);
        zs.push(z);
        if (z < zMin) zMin = z;
        if (z > zMax) zMax = z;
      }
    }
  } catch (err) {
    return { ok: false, error: `Failed to evaluate surface expression "${fn}": ${(err as Error).message}` };
  }

  return { ok: true, surface: { xs, ys, zs, zMin, zMax } };
}
