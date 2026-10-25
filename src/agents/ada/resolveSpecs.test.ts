import { describe, it, expect } from 'vitest';
import { resolveDraw, resolveGraph, resolveScene, resolveVectors, SpecValidationError } from './resolveSpecs';
import type { ChalkDrawSpec, ChalkGraph3DSpec, ChalkGraphSpec, ChalkVectorsSpec } from './spec';

const errorsOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (err instanceof SpecValidationError) return err.errors;
    throw err;
  }
  throw new Error('expected a SpecValidationError');
};

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));

const graph = (extra: Partial<ChalkGraphSpec>): ChalkGraphSpec => ({ kind: 'chalk-graph', curves: [], ...extra });

describe('resolveGraph', () => {
  it('leaves a legacy cartesian spec alone', () => {
    const r = resolveGraph(graph({ graphType: 'cartesian', curves: [{ fn: 'sin(pi*x)' }], points: [{ x: 1, y: 2, label: 'p' }] }));
    expect(r.grid).toBe('cartesian');
    expect(r.curves).toEqual([{ coords: 'cartesian', fn: 'sin(pi*x)', label: undefined }]);
    expect(r.points).toEqual([{ x: 1, y: 2, label: 'p' }]);
    expect(r.xDomain).toBeUndefined();
  });

  it('reads graphType "polar" as the polar grid', () => {
    expect(resolveGraph(graph({ graphType: 'polar' })).grid).toBe('polar');
    expect(resolveGraph(graph({ graphType: 'polar', grid: 'cartesian' })).grid).toBe('cartesian');
  });

  it('resolves polar curves and points, with angles in the spec unit', () => {
    const r = resolveGraph(
      graph({
        grid: 'polar',
        angleUnit: 'degrees',
        curves: [{ coords: 'polar', r: '1 + cos(theta)', thetaDomain: [0, 180] }],
        points: [{ coords: 'polar', r: 2, theta: 90, label: 'top' }],
      }),
    );
    expect(r.curves[0]).toMatchObject({ coords: 'polar', r: '1 + cos(theta)' });
    close((r.curves[0] as { range: number[] }).range, [0, Math.PI]);
    close([r.points[0].x, r.points[0].y], [0, 2]);
  });

  it('fits a polar grid with no domains to the curves and points', () => {
    const r = resolveGraph(graph({ grid: 'polar', curves: [{ coords: 'polar', r: '2' }] }));
    expect(r.xDomain![1]).toBeCloseTo(2.3, 1);
    expect(r.yDomain![1]).toBeCloseTo(2.3, 1);
  });

  it('samples param curves at the params defaults when fitting', () => {
    const r = resolveGraph(
      graph({
        grid: 'polar',
        curves: [{ coords: 'polar', r: 'a' }],
        params: [{ name: 'a', min: 0, max: 10, default: 4 }],
      }),
    );
    expect(r.xDomain![1]).toBeCloseTo(4.6, 1);
  });

  it('fits a curve with a pole to its body, not to the blow-up', () => {
    // A hyperbolic orbit: r → ∞ as cos θ → -1/2, and at θ = 2π/3 floating point gives r ≈ 2e15.
    const r = resolveGraph(graph({ grid: 'polar', curves: [{ coords: 'polar', r: '1/(1 + 2*cos(theta))' }] }));
    expect(r.xDomain![1]).toBeLessThan(20);
    expect(r.xDomain![1]).toBeGreaterThan(1);
    // A bounded curve still gets its whole extent (the cardioid's tip at r = 2).
    const cardioid = resolveGraph(graph({ grid: 'polar', curves: [{ coords: 'polar', r: '1 + cos(theta)' }] }));
    expect(cardioid.xDomain![1]).toBeCloseTo(2.3, 1);
  });

  it('fills in the missing domain of a half-specified polar graph', () => {
    const r = resolveGraph(graph({ grid: 'polar', xDomain: [-3, 3], curves: [{ coords: 'polar', r: '2' }] }));
    expect(r.xDomain).toEqual([-3, 3]);
    expect(r.yDomain![1]).toBeCloseTo(2.3, 1);
  });

  it('accepts a constant radius written as a number', () => {
    const r = resolveGraph(graph({ grid: 'polar', curves: [{ coords: 'polar', r: 2 as never }] }));
    expect(r.curves[0]).toMatchObject({ coords: 'polar', r: '2' });
  });

  it('rejects an empty or reversed axis domain', () => {
    expect(errorsOf(() => resolveGraph(graph({ xDomain: [3, 3] })))).toEqual([expect.stringMatching(/xDomain.*smaller/)]);
  });

  it('reports every problem, naming the item', () => {
    const errors = errorsOf(() =>
      resolveGraph(
        graph({
          grid: 'radial' as never,
          curves: [
            { fn: 'sin(theta)' },
            { coords: 'polar', r: 'x^2' },
            { coords: 'polar' } as never,
            { coords: 'spherical' } as never,
          ],
          points: [{ coords: 'polar', r: 1, theta: 'pi/' } as never, { x: 'a', y: 1, label: 'b' } as never],
        }),
      ),
    );
    expect(errors).toEqual([
      expect.stringContaining('`grid`'),
      expect.stringMatching(/curves\[0\].*theta.*"coords": "polar"/),
      expect.stringMatching(/curves\[1\].*x.*theta/),
      expect.stringMatching(/curves\[2\].*"r"/),
      expect.stringMatching(/curves\[3\].*coords/),
      expect.stringMatching(/points\[0\].*theta/),
      expect.stringMatching(/points\[1\].*x/),
    ]);
  });

  it('does not reject a cartesian fn that only function-plot can parse', () => {
    expect(() => resolveGraph(graph({ curves: [{ fn: 'x^2 +' }] }))).not.toThrow();
  });
});

describe('resolveVectors', () => {
  const vectors = (extra: Partial<ChalkVectorsSpec>): ChalkVectorsSpec => ({ kind: 'chalk-vectors', vectors: [], ...extra });

  it('composes cartesian vectors as before', () => {
    const r = resolveVectors(vectors({ compose: 'head-to-tail', vectors: [{ id: 'a', x: 3, y: 1 }, { id: 'b', x: 0.5, y: 1.5 }] }));
    expect(r.arrows.map((a) => [a.start, a.end])).toEqual([
      [[0, 0], [3, 1]],
      [[3, 1], [3.5, 2.5]],
    ]);
    expect(r.xDomain).toEqual([-5, 5]);
  });

  it('resolves polar magnitude/direction and an explicit tail', () => {
    const r = resolveVectors(
      vectors({ vectors: [{ id: 'f', coords: 'polar', r: 2, theta: 'pi/2', at: { coords: 'polar', r: 1, theta: 0 } }] }),
    );
    close(r.arrows[0].start, [1, 0]);
    close(r.arrows[0].end, [1, 2]);
  });

  it('polar-basis components follow r̂/θ̂ at the tail', () => {
    // At (0, 2), r̂ = +y and θ̂ = -x: 1 r̂ + 3 θ̂ = (-3, 1).
    const r = resolveVectors(
      vectors({ vectors: [{ id: 'v', coords: 'polar-basis', radial: 1, tangential: 3, at: { x: 0, y: 2 }, showBasis: true }] }),
    );
    close(r.arrows[0].end, [-3, 3]);
    close(r.arrows[0].basis!.rHat, [0, 1]);
    close(r.arrows[0].basis!.thetaHat, [-1, 0]);
  });

  it('reports a basis at the origin once, even with showBasis', () => {
    const errors = errorsOf(() =>
      resolveVectors(vectors({ vectors: [{ id: 'v', coords: 'polar-basis', radial: 1, tangential: 0, showBasis: true }] })),
    );
    expect(errors).toHaveLength(1);
  });

  it('refuses a local basis at the origin', () => {
    const errors = errorsOf(() => resolveVectors(vectors({ vectors: [{ id: 'v', coords: 'polar-basis', radial: 1, tangential: 0 }] })));
    expect(errors).toEqual([expect.stringMatching(/vectors\[0\] \("v"\).*origin.*`at`/)]);
  });

  it('fits a polar grid to the arrows when no domain is given', () => {
    const r = resolveVectors(vectors({ grid: 'polar', vectors: [{ id: 'a', x: 0, y: 4 }] }));
    expect(r.yDomain[1]).toBeCloseTo(4.6);
  });
});

describe('resolveDraw', () => {
  it('defaults and validates', () => {
    const d: ChalkDrawSpec = { kind: 'chalk-draw' };
    expect(resolveDraw(d)).toMatchObject({ grid: 'cartesian', angleUnit: 'radians', xDomain: [-5, 5], yDomain: [-5, 5] });
    expect(errorsOf(() => resolveDraw({ ...d, angleUnit: 'gradians' as never }))).toEqual([expect.stringContaining('`angleUnit`')]);
  });
});

describe('resolveScene', () => {
  const scene = (extra: Partial<ChalkGraph3DSpec>): ChalkGraph3DSpec => ({ kind: 'chalk-graph3d', ...extra });

  it('resolves every Point3D form to cartesian', () => {
    const r = resolveScene(
      scene({
        points: [
          { id: 'a', position: [1, 2, 3] },
          { id: 'b', position: { coords: 'cartesian', x: 1, y: 2, z: 3 } },
          { id: 'c', position: { coords: 'cylindrical', r: 2, azimuth: 'pi/2', z: 1 } },
          { id: 'd', position: { coords: 'spherical', rho: 2, polar: 'pi/2', azimuth: 0 } },
        ],
      }),
    );
    close(r.points[0].position, [1, 2, 3]);
    close(r.points[1].position, [1, 2, 3]);
    close(r.points[2].position, [0, 2, 1]);
    close(r.points[3].position, [2, 0, 0]);
    expect(r.grid).toBe('none');
  });

  it('resolves vectors from local-basis components, with the basis on request', () => {
    const r = resolveScene(
      scene({
        vectors: [
          { from: [2, 0, 0], components: { coords: 'cylindrical-basis', radial: 0, azimuthal: 1, z: 0 }, showBasis: true },
          { from: { coords: 'spherical', rho: 1, polar: 'pi/2', azimuth: 0 }, components: { coords: 'spherical-basis', radial: 0, polar: 1, azimuthal: 0 } },
        ],
      }),
    );
    // At (2, 0, 0), φ̂ = +y.
    close(r.vectors[0].to, [2, 1, 0]);
    expect(r.vectors[0].basis!.map((b) => b.label)).toEqual(['r̂', 'φ̂', 'ẑ']);
    // On the equator at azimuth 0, θ̂ (towards increasing polar) = -z.
    close(r.vectors[1].to, [1, 0, -1]);
  });

  it('builds curvilinear surface inputs with default domains', () => {
    const r = resolveScene(
      scene({
        surfaces: [
          { fn: 'x*y' },
          { coords: 'cylindrical', z: 'exp(-r^2)' },
          { coords: 'cylindrical', r: '1 + z^2', zDomain: [-1, 1] },
          { coords: 'spherical', rho: 'sin(polar)^2', azimuthDomain: [0, 'pi'] },
        ],
      }),
    );
    expect(r.surfaces[0].kind).toBe('cartesian');
    const [, a, b, c] = r.surfaces.map((s) => (s.kind === 'curvilinear' ? s.input : null));
    expect(a).toMatchObject({ form: 'cylindrical-z', expr: 'exp(-r^2)', uDomain: [0, 3] });
    close(a!.vDomain, [0, 2 * Math.PI]);
    expect(b).toMatchObject({ form: 'cylindrical-r', vDomain: [-1, 1] });
    expect(c).toMatchObject({ form: 'spherical-rho' });
    close(c!.uDomain, [0, Math.PI]);
    close(c!.vDomain, [0, Math.PI]);
  });

  it('accepts constant surfaces written as numbers', () => {
    const r = resolveScene(scene({ surfaces: [{ coords: 'spherical', rho: 2 as never }, { coords: 'cylindrical', z: 0 as never }] }));
    expect(r.surfaces.map((s) => s.kind === 'curvilinear' && s.input.expr)).toEqual(['2', '0']);
  });

  it('reports surface and vector problems', () => {
    const errors = errorsOf(() =>
      resolveScene(
        scene({
          surfaces: [
            { coords: 'cylindrical', z: 'r', r: '2' } as never,
            { coords: 'spherical', rho: 'sin(theta)' },
            { fn: 'r^2' },
          ],
          vectors: [
            { from: [0, 0, 1], components: { coords: 'cylindrical-basis', radial: 1, azimuthal: 0, z: 0 } },
            { from: [0, 0, 0] } as never,
            { from: [1, 1, 1], to: [1, 2, 3], showBasis: true },
          ],
          points: [{ id: 'p', position: [1, 2] as never }],
        }),
      ),
    );
    expect(errors).toEqual([
      expect.stringMatching(/points\[0\] \("p"\).*\[x, y, z\]/),
      expect.stringMatching(/vectors\[0\].*z-axis/),
      expect.stringMatching(/vectors\[1\].*`to` or `components`/),
      expect.stringMatching(/vectors\[2\].*showBasis/),
      expect.stringMatching(/surfaces\[0\].*exactly one/),
      expect.stringMatching(/surfaces\[1\].*theta.*polar, azimuth/),
      expect.stringMatching(/surfaces\[2\].*r.*x, y/),
    ]);
  });
});
