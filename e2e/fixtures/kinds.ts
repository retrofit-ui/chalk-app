import type {
  ChalkGraphSpec,
  ChalkDrawSpec,
  ChalkSetsSpec,
  ChalkGraph3DSpec,
  ChalkVectorsSpec,
  ChalkMatrixSpec,
  ChalkMatmulSpec,
  ChalkComputeGraphSpec,
  ChalkAnswerBoxSpec,
} from '../../src/agents/ada/spec';

// One minimal, deterministic spec per kind ChalkSpecRenderer dispatches on.
// Every fixture carries at least one property a test can assert on that is
// not satisfied by "some div rendered" (cell counts, node counts, titles…).

export const graph: ChalkGraphSpec = {
  kind: 'chalk-graph',
  graphType: 'cartesian',
  title: 'Parabola fixture',
  curves: [{ fn: 'x^2', label: 'y = x²' }],
  xDomain: [-3, 3],
  yDomain: [-1, 9],
};

export const interactiveGraph: ChalkGraphSpec = {
  ...graph,
  title: 'Click me',
  interactive: true,
};

export const draw: ChalkDrawSpec = {
  kind: 'chalk-draw',
  title: 'Sketch fixture',
  prompt: 'Draw a line through the origin',
};

export const sets: ChalkSetsSpec = {
  kind: 'chalk-sets',
  title: 'Sets fixture',
  universe: 'U',
  sets: [
    { id: 'A', label: 'A', cx: 0.4, cy: 0.5, rx: 0.25, ry: 0.3 },
    { id: 'B', label: 'B', cx: 0.6, cy: 0.5, rx: 0.25, ry: 0.3 },
    { id: 'C', label: 'C', cx: 0.5, cy: 0.3, rx: 0.15, ry: 0.15 },
  ],
};

export const graph3d: ChalkGraph3DSpec = {
  kind: 'chalk-graph3d',
  title: '3D fixture',
  points: [{ id: 'p', position: [1, 1, 1], label: 'P' }],
  vectors: [{ from: [0, 0, 0], to: [1, 1, 1], label: 'v' }],
};

export const vectors: ChalkVectorsSpec = {
  kind: 'chalk-vectors',
  title: 'Vectors fixture',
  vectors: [
    { id: 'u', x: 2, y: 1, label: 'u' },
    { id: 'v', x: -1, y: 3, label: 'v' },
  ],
};

export const matrix: ChalkMatrixSpec = {
  kind: 'chalk-matrix',
  title: 'Matrix fixture',
  values: [
    [1, 2, 3],
    [4, 5, 6],
  ],
  precision: 0,
};

export const matmul: ChalkMatmulSpec = {
  kind: 'chalk-matmul',
  title: 'Matmul fixture',
  a: [
    [1, 2],
    [3, 4],
  ],
  b: [
    [5, 6],
    [7, 8],
  ],
  precision: 0,
};
/** Expected C = A×B for the fixture above, row-major. */
export const matmulResult = [
  [19, 22],
  [43, 50],
];

export const computeGraph: ChalkComputeGraphSpec = {
  kind: 'chalk-compute-graph',
  title: 'Compute graph fixture',
  nodes: [
    { id: 'x', label: 'x', layer: 0, slot: 0 },
    { id: 'w', label: 'w', layer: 0, slot: 1 },
    { id: 'mul', label: 'mul', layer: 1, slot: 0 },
    { id: 'out', label: 'out', layer: 2, slot: 0 },
  ],
  edges: [
    { from: 'x', to: 'mul' },
    { from: 'w', to: 'mul' },
    { from: 'mul', to: 'out' },
  ],
};

export const answerbox: ChalkAnswerBoxSpec = {
  kind: 'answerbox',
  identifier: 'slope',
  label: 'What is the slope?',
  placeholder: 'e.g. 2',
};

export const twoAnswerboxes = {
  kind: 'flex',
  direction: 'column',
  children: [
    { kind: 'answerbox', identifier: 'slope', label: 'Slope' },
    { kind: 'answerbox', identifier: 'intercept', label: 'Intercept' },
  ],
};

export const text = {
  kind: 'text',
  variant: 'muted',
  content: 'A muted **text** node',
};

export const card = {
  kind: 'card',
  header: 'Card header fixture',
  children: [{ kind: 'text', content: 'inside the card' }],
};

export const flexRow = {
  kind: 'flex',
  direction: 'row',
  children: [
    { kind: 'text', content: 'left' },
    { kind: 'text', content: 'right' },
  ],
};

export const grid = {
  kind: 'grid',
  columns: 3,
  children: [
    { kind: 'text', content: 'one' },
    { kind: 'text', content: 'two' },
    { kind: 'text', content: 'three' },
  ],
};

export const stat = {
  kind: 'stat',
  stats: [
    { label: 'Determinant', value: 42, description: 'ad − bc' },
    { label: 'Rank', value: 2 },
  ],
};

/** No local Match for this kind → falls through to retrofit-ui's SpecRenderer. */
export const fallbackTimeline = {
  kind: 'timeline',
  events: [
    { timestamp: '2026-01-01T00:00:00Z', title: 'Fallback event one' },
    { timestamp: '2026-01-02T00:00:00Z', title: 'Fallback event two' },
  ],
};
