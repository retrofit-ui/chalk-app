import type { ChalkDrawSpec, ChalkGraph3DSpec, ChalkGraphSpec, ChalkVectorsSpec } from '../../src/agents/ada/spec';

// Polar/cylindrical/spherical fixtures. Each carries something only a correct
// resolution produces (a round ring, an arrow tip at a known pixel, a surface
// that mounts without a spec error).

export const polarGraph: ChalkGraphSpec = {
  kind: 'chalk-graph',
  grid: 'polar',
  title: 'Cardioid fixture',
  curves: [{ coords: 'polar', r: '1 + cos(theta)', label: 'cardioid' }],
  points: [{ coords: 'polar', r: 2, theta: 0, label: 'tip' }],
};

export const interactivePolarGraph: ChalkGraphSpec = {
  ...polarGraph,
  interactive: true,
  xDomain: [-3, 3],
  yDomain: [-3, 3],
};

// A rose with pi in it: function-plot's parser alone doesn't know `pi`.
export const piCurveGraph: ChalkGraphSpec = {
  kind: 'chalk-graph',
  grid: 'polar',
  angleUnit: 'degrees',
  title: 'Rose fixture',
  curves: [{ coords: 'polar', r: '2*cos(2*(theta - pi/4))' }],
  xDomain: [-3, 3],
  yDomain: [-3, 3],
};

export const badPolarGraph: ChalkGraphSpec = {
  kind: 'chalk-graph',
  grid: 'polar',
  curves: [{ coords: 'polar', r: 'x^2' }],
};

// At (0, 2): r̂ = +y, θ̂ = -x, so 1 r̂ + 2 θ̂ points to (-2, 3).
export const polarBasisVectors: ChalkVectorsSpec = {
  kind: 'chalk-vectors',
  grid: 'polar',
  title: 'Local basis fixture',
  xDomain: [-4, 4],
  yDomain: [-4, 4],
  vectors: [
    { id: 'pos', coords: 'polar', r: 2, theta: 'pi/2', label: 'r' },
    { id: 'v', coords: 'polar-basis', radial: 1, tangential: 2, at: { coords: 'polar', r: 2, theta: 'pi/2' }, showBasis: true, label: 'v' },
  ],
};

export const polarDraw: ChalkDrawSpec = {
  kind: 'chalk-draw',
  grid: 'polar',
  angleUnit: 'degrees',
  title: 'Polar canvas fixture',
  prompt: 'Sketch r = 2',
  xDomain: [-3, 3],
  yDomain: [-3, 3],
};

export const curvilinearScene: ChalkGraph3DSpec = {
  kind: 'chalk-graph3d',
  title: 'Curvilinear fixture',
  grid: 'polar',
  surfaces: [
    { coords: 'cylindrical', z: 'exp(-r^2)', label: 'bump' },
    { coords: 'cylindrical', r: '1 + z^2/4', zDomain: [-1, 1], label: 'vase', wireframe: true },
    { coords: 'spherical', rho: 'sin(polar)^2', label: 'dipole' },
  ],
  points: [{ id: 'p', position: { coords: 'spherical', rho: 1, polar: 'pi/2', azimuth: 0 }, label: 'p' }],
  vectors: [
    { from: { coords: 'cylindrical', r: 2, azimuth: 0, z: 0 }, components: { coords: 'cylindrical-basis', radial: 0, azimuthal: 1, z: 0 }, showBasis: true, label: 'v' },
  ],
};

export const badScene: ChalkGraph3DSpec = {
  kind: 'chalk-graph3d',
  surfaces: [{ coords: 'spherical', rho: 'sin(theta)' }],
};
