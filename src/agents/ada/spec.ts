import type { RootSpec } from '@retrofit-ui/core';
import type { Angle, AngleUnit } from './coords';

// Coordinates: every curve, point, vector and surface says which system its numbers are
// in (`coords`, default "cartesian"); the grid it is drawn on is chosen separately.
// Renderers resolve all of it to cartesian up front (resolveSpecs.ts).

export type PlotGrid = 'cartesian' | 'polar';

export type Point2D =
  | { coords?: 'cartesian'; x: number; y: number }
  | { coords: 'polar'; r: number; theta: Angle };

export type CartesianCurve = {
  coords?: 'cartesian';
  fn: string;
  label?: string;
};

/** r as a function of theta (radians), drawn over thetaDomain (default [0, 2π]). */
export type PolarCurve = {
  coords: 'polar';
  r: string;
  thetaDomain?: [Angle, Angle];
  label?: string;
};

export type ChalkCurve = CartesianCurve | PolarCurve;

export type LabelledPoint = Point2D & { label: string };

export type ChalkGraphParam = {
  name: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  label?: string;
};

export type ChalkGraphSpec = {
  kind: 'chalk-graph';
  /** Legacy; "polar" is read as `grid: "polar"` when `grid` is absent. */
  graphType?: 'cartesian' | 'polar';
  grid?: PlotGrid;
  angleUnit?: AngleUnit;
  curves: ChalkCurve[];
  points?: LabelledPoint[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  title?: string;
  interactive?: boolean;
  size?: 'small' | 'medium' | 'large';
  params?: ChalkGraphParam[];
};

export type ChalkDrawSpec = {
  kind: 'chalk-draw';
  grid?: PlotGrid;
  angleUnit?: AngleUnit;
  xDomain?: [number, number];
  yDomain?: [number, number];
  title?: string;
  prompt?: string;
  size?: 'small' | 'medium' | 'large';
};

export type SetShape = {
  id: string;
  label?: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  colorIndex?: number;
  fillOpacity?: number;
};

export type PartitionLine = {
  id: string;
  x?: number;
  y?: number;
  label?: string;
};

export type SetAnnotation = {
  x: number;
  y: number;
  text: string;
  align?: 'left' | 'center' | 'right';
};

export type ChalkSetsSpec = {
  kind: 'chalk-sets';
  title?: string;
  universe?: string;
  sets: SetShape[];
  partitions?: PartitionLine[];
  annotations?: SetAnnotation[];
  size?: 'small' | 'medium' | 'large';
};

export type ChalkAnswerBoxSpec = {
  kind: 'answerbox';
  identifier: string;
  label?: string;
  placeholder?: string;
};

export type Vec3 = [number, number, number];

/** A 3D position: a bare [x, y, z], or explicit cartesian/cylindrical/spherical coordinates. */
export type Point3D =
  | Vec3
  | { coords: 'cartesian'; x: number; y: number; z: number }
  | { coords: 'cylindrical'; r: number; azimuth: Angle; z: number }
  | { coords: 'spherical'; rho: number; polar: Angle; azimuth: Angle };

/** A vector's components along the cartesian axes or along the local basis at its tail. */
export type VectorComponents3D =
  | { coords: 'cartesian'; x: number; y: number; z: number }
  | { coords: 'cylindrical-basis'; radial: number; azimuthal: number; z: number }
  | { coords: 'spherical-basis'; radial: number; polar: number; azimuthal: number };

export type Chalk3DPlane = {
  point: Point3D;
  basis1: Vec3;
  basis2: Vec3;
  label?: string;
  extent?: number;
  colorIndex?: number;
};

export type Chalk3DPoint = {
  id: string;
  position: Point3D;
  label?: string;
  colorIndex?: number;
  draggable?: boolean;
};

export type Chalk3DVector = {
  from: Point3D;
  /** Give either `to` or `components`. */
  to?: Point3D;
  components?: VectorComponents3D;
  /** Draw the local unit basis at `from` (for cylindrical-/spherical-basis components). */
  showBasis?: boolean;
  label?: string;
  colorIndex?: number;
  style?: 'solid' | 'dashed';
};

type SurfaceStyle = {
  label?: string;
  resolution?: number; // samples per axis, default 40, clamped to 80
  colorScale?: 'sequential' | 'diverging'; // by z-height, same convention as ChalkMatrixSpec; default sequential
  opacity?: number; // default 0.85
  wireframe?: boolean; // default false
};

// The key of the solved coordinate (fn/z, r, rho) is what fixes the form.
export type Chalk3DSurface = SurfaceStyle &
  (
    | {
        coords?: 'cartesian';
        fn: string; // two-variable mathjs expression, e.g. "(x-1)^2 + 2*(y+0.5)^2"
        xDomain?: [number, number]; // default [-3, 3]
        yDomain?: [number, number]; // default [-3, 3]
      }
    /** z = f(r, azimuth): a height map over a disc. */
    | { coords: 'cylindrical'; z: string; rDomain?: [number, number]; azimuthDomain?: [Angle, Angle] }
    /** r = f(azimuth, z): distance out from the z-axis. */
    | { coords: 'cylindrical'; r: string; azimuthDomain?: [Angle, Angle]; zDomain?: [number, number] }
    /** rho = f(polar, azimuth): distance out from the origin. */
    | { coords: 'spherical'; rho: string; polarDomain?: [Angle, Angle]; azimuthDomain?: [Angle, Angle] }
  );

export type Chalk3DPath = {
  id: string;
  points: Point3D[]; // ordered waypoints, agent-provided (e.g. gradient descent steps) — never computed by the renderer
  label?: string;
  colorIndex?: number;
  showMarkers?: boolean; // default true
  animate?: boolean; // default false — animate a marker traveling along the path once on mount
};

export type ChalkGraph3DSpec = {
  kind: 'chalk-graph3d';
  title?: string;
  planes?: Chalk3DPlane[];
  points?: Chalk3DPoint[];
  vectors?: Chalk3DVector[];
  surfaces?: Chalk3DSurface[];
  paths?: Chalk3DPath[];
  showAxes?: boolean;
  /** Floor grid in z = 0; default "none". */
  grid?: 'none' | PlotGrid;
  angleUnit?: AngleUnit;
  size?: 'small' | 'medium' | 'large';
};

/** Components: cartesian, polar (magnitude + direction), or along r̂/θ̂ at the tail. */
export type VectorComponents2D =
  | { coords?: 'cartesian'; x: number; y: number }
  | { coords: 'polar'; r: number; theta: Angle }
  | { coords: 'polar-basis'; radial: number; tangential: number };

export type ChalkVector2D = VectorComponents2D & {
  id: string;
  /** Explicit tail; overrides `compose` for this vector. */
  at?: Point2D;
  /** Draw the unit r̂ and θ̂ at the tail. */
  showBasis?: boolean;
  label?: string;
  colorIndex?: number;
};

export type ChalkVectorsSpec = {
  kind: 'chalk-vectors';
  title?: string;
  vectors: ChalkVector2D[];
  compose?: 'origin' | 'head-to-tail';
  grid?: PlotGrid;
  angleUnit?: AngleUnit;
  xDomain?: [number, number];
  yDomain?: [number, number];
  size?: 'small' | 'medium' | 'large';
};

export type ChalkMatrixCellNote = {
  row: number;
  col: number;
  formula: string;
  note?: string;
};

export type ChalkMatrixSpec = {
  kind: 'chalk-matrix';
  title?: string;
  values: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  colorScale?: 'sequential' | 'diverging';
  highlightDiagonal?: boolean;
  precision?: number;
  size?: 'small' | 'medium' | 'large';
  cellNotes?: ChalkMatrixCellNote[];
  outputVar?: string;
  inputVar?: string;
};

export type ChalkMatmulSpec = {
  kind: 'chalk-matmul';
  title?: string;
  a: number[][];
  b: number[][];
  aLabel?: string;
  bLabel?: string;
  rowLabelsA?: string[];
  colLabelsA?: string[];
  rowLabelsB?: string[];
  colLabelsB?: string[];
  precision?: number;
  size?: 'small' | 'medium' | 'large';
};

export type ComputeGraphNode = {
  id: string;
  label: string; // short name/symbol shown in the box, e.g. "r₁", "w₁", "matmul", "ReLU"
  formula?: string; // optional LaTeX shown under the label, e.g. "w_1 = r_1^2 + r_2"
  shape?: string[]; // optional tensor shape tag, e.g. ["n", "784"] — rendered as a small caption
  layer: number; // 0-indexed position along the flow direction (column if row-direction, row if column-direction)
  slot: number; // 0-indexed position within that layer (lets parallel/branching nodes sit side by side)
  colorIndex?: number;
  style?: 'box' | 'circle'; // default 'box'
};

export type ComputeGraphEdge = {
  from: string; // node id
  to: string; // node id
  label?: string; // optional LaTeX or plain text, e.g. a local derivative or a shape annotation
};

export type ChalkComputeGraphSpec = {
  kind: 'chalk-compute-graph';
  title?: string;
  direction?: 'row' | 'column'; // default 'row' — overall flow direction of increasing `layer`
  nodes: ComputeGraphNode[];
  edges: ComputeGraphEdge[];
  size?: 'small' | 'medium' | 'large';
};

// ── State-machine family (chalk-automaton, chalk-search, chalk-markov, chalk-mdp) ──
// All four share one diagram: circles for states, curved arrows for transitions,
// loops for self-transitions. Ada declares the machine; the renderer's pure engines
// (src/agents/ada/statemachines/) compute every number shown, so the picture can never
// disagree with its own arithmetic.

export type MachineState = {
  id: string;
  label?: string; // shown inside the circle; defaults to id
  x?: number; // grid column (fractions allowed); omit on every state for a circular layout
  y?: number; // grid row
  colorIndex?: number;
};

export type AutomatonState = MachineState & { accept?: boolean };

export type AutomatonTransition = {
  from: string;
  to: string;
  symbols: string[]; // input symbols that fire this edge; "" or "ε" is an epsilon move
};

export type ChalkAutomatonSpec = {
  kind: 'chalk-automaton';
  title?: string;
  states: AutomatonState[];
  start: string;
  transitions: AutomatonTransition[];
  input?: string; // pre-filled input; single-character symbols are read char by char, otherwise space-separated
  examples?: string[]; // quick-pick inputs shown as buttons
  size?: 'small' | 'medium' | 'large';
};

export type SearchState = MachineState & { h?: number }; // heuristic estimate of cost to the goal

export type SearchEdge = {
  from: string;
  to: string;
  cost?: number; // default 1
  label?: string; // shown instead of the cost when given
};

export type SearchAlgorithm = 'bfs' | 'dijkstra' | 'greedy' | 'astar';

export type ChalkSearchSpec = {
  kind: 'chalk-search';
  title?: string;
  states: SearchState[];
  edges: SearchEdge[];
  directed?: boolean; // default true
  start: string;
  goal: string;
  algorithm?: SearchAlgorithm; // initial algorithm; default 'astar' if any state has h, else 'dijkstra'
  algorithms?: SearchAlgorithm[]; // which algorithm buttons to offer; default all four
  editable?: boolean; // let the student change edge costs and h values
  size?: 'small' | 'medium' | 'large';
};

export type MarkovTransition = { from: string; to: string; p: number };

export type ChalkMarkovSpec = {
  kind: 'chalk-markov';
  title?: string;
  states: MachineState[];
  transitions: MarkovTransition[];
  start?: string; // default first state
  showMatrix?: boolean; // default true
  editable?: boolean; // probability inputs; editing one rescales the rest of its row
  seed?: number; // random-walk seed, for reproducible demos
  size?: 'small' | 'medium' | 'large';
};

export type MdpState = MachineState & { terminal?: boolean };

export type MdpOutcome = { to: string; p: number; reward?: number };

export type MdpAction = {
  from: string;
  name: string;
  outcomes: MdpOutcome[];
};

export type ChalkMdpSpec = {
  kind: 'chalk-mdp';
  title?: string;
  states: MdpState[];
  actions: MdpAction[];
  gamma?: number; // discount, default 0.9
  size?: 'small' | 'medium' | 'large';
};

// Chunks in a Chalk message are either a top-level retrofit spec or a chalk-specific spec.
// Using RootSpec (not ViewSpec) because chunks are rendered via SpecRenderer which accepts RootSpec.
export type ChalkViewSpec =
  | RootSpec
  | ChalkGraphSpec
  | ChalkDrawSpec
  | ChalkSetsSpec
  | ChalkAnswerBoxSpec
  | ChalkGraph3DSpec
  | ChalkVectorsSpec
  | ChalkMatrixSpec
  | ChalkMatmulSpec
  | ChalkComputeGraphSpec
  | ChalkAutomatonSpec
  | ChalkSearchSpec
  | ChalkMarkovSpec
  | ChalkMdpSpec;
