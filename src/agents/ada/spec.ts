import type { RootSpec } from '@retrofit-ui/core';

export type CartesianCurve = {
  fn: string;
  label?: string;
};

export type LabelledPoint = {
  x: number;
  y: number;
  label: string;
};

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
  graphType: 'cartesian';
  curves: CartesianCurve[];
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

export type Chalk3DPlane = {
  point: Vec3;
  basis1: Vec3;
  basis2: Vec3;
  label?: string;
  extent?: number;
  colorIndex?: number;
};

export type Chalk3DPoint = {
  id: string;
  position: Vec3;
  label?: string;
  colorIndex?: number;
  draggable?: boolean;
};

export type Chalk3DVector = {
  from: Vec3;
  to: Vec3;
  label?: string;
  colorIndex?: number;
  style?: 'solid' | 'dashed';
};

export type ChalkGraph3DSpec = {
  kind: 'chalk-graph3d';
  title?: string;
  planes?: Chalk3DPlane[];
  points?: Chalk3DPoint[];
  vectors?: Chalk3DVector[];
  showAxes?: boolean;
  size?: 'small' | 'medium' | 'large';
};

export type ChalkVector2D = {
  id: string;
  x: number;
  y: number;
  label?: string;
  colorIndex?: number;
};

export type ChalkVectorsSpec = {
  kind: 'chalk-vectors';
  title?: string;
  vectors: ChalkVector2D[];
  compose?: 'origin' | 'head-to-tail';
  xDomain?: [number, number];
  yDomain?: [number, number];
  size?: 'small' | 'medium' | 'large';
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
  | ChalkMatrixSpec;
