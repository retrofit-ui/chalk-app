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

// Chunks in a Chalk message are either a top-level retrofit spec or a chalk-specific spec.
// Using RootSpec (not ViewSpec) because chunks are rendered via SpecRenderer which accepts RootSpec.
export type ChalkViewSpec = RootSpec | ChalkGraphSpec | ChalkDrawSpec | ChalkSetsSpec;
