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
};

// Chunks in a Chalk message are either a top-level retrofit spec or a chalk-specific spec.
// Using RootSpec (not ViewSpec) because chunks are rendered via SpecRenderer which accepts RootSpec.
export type ChalkViewSpec = RootSpec | ChalkGraphSpec;
