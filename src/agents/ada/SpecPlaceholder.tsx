import type { Component } from 'solid-js';
import SpecErrors from './statemachines/SpecErrors';
import { SpecValidationError } from './resolveSpecs';

const NAMES: Record<string, string> = {
  'chalk-graph': 'graph',
  'chalk-draw': 'drawing canvas',
  'chalk-sets': 'Venn diagram',
  'chalk-graph3d': '3D plot',
  'chalk-vectors': 'vector diagram',
  'chalk-matrix': 'matrix',
  'chalk-matmul': 'matrix multiplication',
  'chalk-compute-graph': 'computation graph',
  'chalk-automaton': 'automaton',
  'chalk-search': 'search tree',
  'chalk-markov': 'Markov chain',
  'chalk-mdp': 'MDP',
  answerbox: 'answer box',
};

export function friendlyKindName(kind: string | undefined): string | undefined {
  if (!kind) return undefined;
  return NAMES[kind] ?? kind;
}

/**
 * Stands in for a spec that is still streaming and can't be drawn yet: its
 * kind hasn't arrived, or its component can't cope with what has so far.
 */
export const SpecPlaceholder: Component<{ kind?: string }> = (props) => {
  const name = () => friendlyKindName(props.kind);
  return (
    <div
      data-testid="spec-placeholder"
      data-placeholder-kind={props.kind ?? ''}
      role="status"
      class="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 animate-pulse min-h-12 data-[big=true]:min-h-48"
      data-big={props.kind?.startsWith('chalk-') ? 'true' : 'false'}
    >
      {name() ? `Drawing ${name()}…` : 'Drawing…'}
    </div>
  );
};

/** A finished spec whose component threw: it won't fix itself, so say so. */
export const SpecRenderError: Component<{ kind?: string; error: unknown }> = (props) => (
  <SpecErrors
    kind={friendlyKindName(props.kind) ?? 'untyped'}
    errors={
      !props.kind
        ? ['The spec has no "kind".']
        : props.error instanceof SpecValidationError
          ? props.error.errors
          : [String((props.error as Error)?.message ?? props.error)]
    }
  />
);
