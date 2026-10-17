import {
  type Component,
  type JSX,
  createContext,
  createMemo,
  createSignal,
  ErrorBoundary,
  For,
  Index,
  Match,
  onMount,
  Show,
  Switch,
  untrack,
  useContext,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { SpecRenderer } from '@retrofit-ui/spa-solid-shoelace/components';
import type { RootSpec } from '@retrofit-ui/core';
import type {
  ChalkViewSpec,
  ChalkGraphSpec,
  ChalkDrawSpec,
  ChalkSetsSpec,
  ChalkGraph3DSpec,
  ChalkVectorsSpec,
  ChalkMatrixSpec,
  ChalkMatmulSpec,
  ChalkComputeGraphSpec,
  ChalkAutomatonSpec,
  ChalkSearchSpec,
  ChalkMarkovSpec,
  ChalkMdpSpec,
} from './spec';
import CartesianGraph from './CartesianGraph';
import DrawCanvas from './DrawCanvas';
import SetsRenderer from './SetsRenderer';
import Scene3D from './Scene3D';
import VectorDiagram from './VectorDiagram';
import MatrixHeatmap from './MatrixHeatmap';
import MatrixMultiplyView from './MatrixMultiplyView';
import ComputeGraph from './ComputeGraph';
import AutomatonView from './statemachines/AutomatonView';
import SearchView from './statemachines/SearchView';
import MarkovView from './statemachines/MarkovView';
import MdpView from './statemachines/MdpView';
import { isIncomplete } from './partialJson';
import { SpecPlaceholder, SpecRenderError } from './SpecPlaceholder';

type ViewNodeProps = {
  spec: { kind: string } & Record<string, unknown>;
  onGraphClick?: (points: Array<{ x: number; y: number }>) => void;
  onDrawSubmit?: (imageBase64: string) => void;
};

type AnswerContextValue = {
  answers: Record<string, string>;
  setAnswer: (identifier: string, value: string) => void;
};

const AnswerContext = createContext<AnswerContextValue>();

function collectAnswerBoxIdentifiers(nodes: ViewNodeProps['spec'][], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.kind === 'answerbox' && typeof node.identifier === 'string') {
      out.push(node.identifier);
    }
    if (Array.isArray(node.children)) {
      collectAnswerBoxIdentifiers(node.children as ViewNodeProps['spec'][], out);
    }
  }
  return out;
}

const LeafView: Component<ViewNodeProps> = (props) => {
  return (
    <Switch>
      <Match when={props.spec.kind === 'chalk-graph'}>
        <CartesianGraph spec={props.spec as unknown as ChalkGraphSpec} onGraphClick={props.onGraphClick} />
      </Match>
      <Match when={props.spec.kind === 'chalk-draw'}>
        <DrawCanvas spec={props.spec as unknown as ChalkDrawSpec} onSubmit={props.onDrawSubmit ?? (() => {})} />
      </Match>
      <Match when={props.spec.kind === 'chalk-sets'}>
        <SetsRenderer spec={props.spec as unknown as ChalkSetsSpec} />
      </Match>
      <Match when={props.spec.kind === 'chalk-graph3d'}>
        <Scene3D spec={props.spec as unknown as ChalkGraph3DSpec} />
      </Match>
      <Match when={props.spec.kind === 'chalk-vectors'}>
        <VectorDiagram spec={props.spec as unknown as ChalkVectorsSpec} />
      </Match>
      <Match when={props.spec.kind === 'chalk-matrix'}>
        <MatrixHeatmap spec={props.spec as unknown as ChalkMatrixSpec} />
      </Match>
      <Match when={props.spec.kind === 'chalk-matmul'}>
        <MatrixMultiplyView spec={props.spec as unknown as ChalkMatmulSpec} />
      </Match>
      <Match when={props.spec.kind === 'chalk-compute-graph'}>
        <ComputeGraph spec={props.spec as unknown as ChalkComputeGraphSpec} />
      </Match>
      <Match when={props.spec.kind === 'chalk-automaton'}>
        <AutomatonView spec={props.spec as unknown as ChalkAutomatonSpec} />
      </Match>
      <Match when={props.spec.kind === 'chalk-search'}>
        <SearchView spec={props.spec as unknown as ChalkSearchSpec} />
      </Match>
      <Match when={props.spec.kind === 'chalk-markov'}>
        <MarkovView spec={props.spec as unknown as ChalkMarkovSpec} />
      </Match>
      <Match when={props.spec.kind === 'chalk-mdp'}>
        <MdpView spec={props.spec as unknown as ChalkMdpSpec} />
      </Match>
      <Match when={props.spec.kind === 'text'}>
        <div
          data-kind="text"
          class="leading-normal data-[variant=body]:text-sm data-[variant=body]:text-slate-800 data-[variant=muted]:text-[13px] data-[variant=muted]:text-slate-500 data-[variant=small]:text-xs data-[variant=small]:text-slate-600"
          data-variant={(props.spec.variant as string) ?? 'body'}
        >
          <SpecRenderer
            spec={{ kind: 'markdown', content: props.spec.content as string } as unknown as RootSpec}
            apiBase=""
          />
        </div>
      </Match>
      <Match when={props.spec.kind === 'answerbox'}>
        {(() => {
          const ctx = useContext(AnswerContext);
          const identifier = props.spec.identifier as string;
          return (
            <div data-kind="answerbox" class="flex flex-col gap-1 max-w-64">
              <Show when={props.spec.label as string | undefined}>
                <label class="text-xs font-medium text-slate-600">{props.spec.label as string}</label>
              </Show>
              <input
                data-testid="answerbox-input"
                type="text"
                class="text-sm py-1.5 px-2.5 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={props.spec.placeholder as string | undefined}
                value={ctx?.answers[identifier] ?? ''}
                onInput={(e) => ctx?.setAnswer(identifier, e.currentTarget.value)}
              />
            </div>
          );
        })()}
      </Match>
      <Match when={props.spec.kind === 'stat'}>
        <div data-kind="stat" class="flex flex-wrap gap-4">
          <For
            each={
              props.spec.stats as Array<{ label: string; value: number | string; description?: string }>
            }
          >
            {(s) => (
              <div class="flex flex-col gap-0.5 min-w-0">
                <div class="text-[11px] text-slate-500 uppercase tracking-wide font-medium">
                  <SpecRenderer spec={{ kind: 'markdown', content: String(s.label) } as unknown as RootSpec} apiBase="" />
                </div>
                <div class="text-xl font-semibold text-slate-800 tabular-nums">
                  <SpecRenderer spec={{ kind: 'markdown', content: String(s.value) } as unknown as RootSpec} apiBase="" />
                </div>
                <Show when={s.description}>
                  <div class="text-xs text-slate-400">
                    <SpecRenderer spec={{ kind: 'markdown', content: s.description! } as unknown as RootSpec} apiBase="" />
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Match>
      <Match when={true}>
        <SpecRenderer spec={props.spec as unknown as RootSpec} apiBase="" />
      </Match>
    </Switch>
  );
};

/**
 * Renders one node of a reply. Layout containers (flex, grid, card) render
 * live, so their children can stream in one by one. Every other node is a
 * leaf, drawn by LeafNode from a frozen snapshot of its spec.
 */
const ViewNode: Component<ViewNodeProps> = (props) => {
  return (
    <Switch fallback={<LeafNode spec={props.spec} onGraphClick={props.onGraphClick} onDrawSubmit={props.onDrawSubmit} />}>
      <Match when={typeof props.spec.kind !== 'string'}>
        <Show when={isIncomplete(props.spec)} fallback={<SpecRenderError error={undefined} />}>
          <SpecPlaceholder />
        </Show>
      </Match>
      <Match when={props.spec.kind === 'flex'}>
        <div
          data-kind="flex"
          class="flex data-[direction=row]:*:flex-1 data-[direction=row]:*:min-w-0"
          data-direction={(props.spec.direction as string) ?? 'column'}
          style={{
            'flex-direction': (props.spec.direction as string) ?? 'column',
            gap: (props.spec.gap as string) ?? '0.75rem',
            'align-items': props.spec.align as string | undefined,
            'justify-content': props.spec.justify as string | undefined,
            'flex-wrap': props.spec.wrap ? 'wrap' : undefined,
          }}
        >
          <Index each={(props.spec.children as ViewNodeProps['spec'][] | undefined) ?? []}>
            {(child) => (
              <ViewNode spec={child()} onGraphClick={props.onGraphClick} onDrawSubmit={props.onDrawSubmit} />
            )}
          </Index>
        </div>
      </Match>
      <Match when={props.spec.kind === 'grid'}>
        <div
          data-kind="grid"
          class="grid *:min-w-0"
          style={{
            'grid-template-columns':
              (props.spec.columnTemplate as string) ??
              `repeat(${(props.spec.columns as number) ?? 2}, 1fr)`,
            gap: (props.spec.gap as string) ?? '0.75rem',
            'align-items': props.spec.align as string | undefined,
            'justify-content': props.spec.justify as string | undefined,
          }}
        >
          <Index each={(props.spec.children as ViewNodeProps['spec'][] | undefined) ?? []}>
            {(child) => (
              <ViewNode spec={child()} onGraphClick={props.onGraphClick} onDrawSubmit={props.onDrawSubmit} />
            )}
          </Index>
        </div>
      </Match>
      <Match when={props.spec.kind === 'card'}>
        <div data-kind="card" class="border border-slate-200 rounded-lg bg-white overflow-hidden">
          <Show when={props.spec.header as string | undefined}>
            <div class="py-2 px-3 border-b border-slate-200 bg-slate-50 font-semibold text-sm text-slate-700">{props.spec.header as string}</div>
          </Show>
          <div class="p-3 flex flex-col gap-2">
            <Index each={(props.spec.children as ViewNodeProps['spec'][] | undefined) ?? []}>
              {(child) => (
                <ViewNode spec={child()} onGraphClick={props.onGraphClick} onDrawSubmit={props.onDrawSubmit} />
              )}
            </Index>
          </div>
        </div>
      </Match>
    </Switch>
  );
};

/**
 * Draws a leaf spec, which may be a partial one still streaming in.
 *
 * - The component is remounted only when the leaf's own data changes (keyed by
 *   its JSON), so finished leaves stay mounted while the rest of the reply
 *   streams, and components that read their spec once at mount still update.
 * - If the component throws on a partial spec, the last snapshot that drew
 *   successfully is shown instead, or a placeholder if there is none yet.
 * - If it throws on a finished spec, the error is shown: that won't fix itself.
 */
const LeafNode: Component<ViewNodeProps> = (props) => {
  const json = createMemo(() => JSON.stringify(props.spec));
  const partial = () => isIncomplete(props.spec);
  const [lastGood, setLastGood] = createSignal<string>();
  const draw = (snapshot: string) => (
    <LeafView spec={JSON.parse(snapshot)} onGraphClick={props.onGraphClick} onDrawSubmit={props.onDrawSubmit} />
  );

  return (
    <Show when={json()} keyed>
      {(snapshot) => (
        <ErrorBoundary
          fallback={(error) => (
            <Show when={partial()} fallback={<SpecRenderError kind={props.spec.kind} error={error} />}>
              {(() => {
                const previous = untrack(lastGood);
                if (previous === undefined || previous === snapshot) return <SpecPlaceholder kind={props.spec.kind} />;
                return <ErrorBoundary fallback={<SpecPlaceholder kind={props.spec.kind} />}>{draw(previous)}</ErrorBoundary>;
              })()}
            </Show>
          )}
        >
          <Drawn render={() => draw(snapshot)} onDrawn={() => setLastGood(snapshot)} />
        </ErrorBoundary>
      )}
    </Show>
  );
};

/** Calls `onDrawn` once `render` has mounted without throwing. */
const Drawn: Component<{ render: () => JSX.Element; onDrawn: () => void }> = (props) => {
  const element = props.render();
  onMount(props.onDrawn);
  return element;
};

const ChalkSpecRenderer: Component<{
  chunks: ChalkViewSpec[];
  onGraphClick?: (points: Array<{ x: number; y: number }>) => void;
  onDrawSubmit?: (imageBase64: string) => void;
  onAnswerSubmit?: (answers: Record<string, string>) => void;
  /** The reply is still arriving: answerbox ids may be incomplete, so hold Submit back. */
  streaming?: boolean;
}> = (props) => {
  const [answers, setAnswers] = createStore<Record<string, string>>({});
  const answerContext: AnswerContextValue = {
    get answers() {
      return answers;
    },
    setAnswer: (identifier, value) => setAnswers(identifier, value),
  };
  const identifiers = () => collectAnswerBoxIdentifiers(props.chunks as ViewNodeProps['spec'][]);

  return (
    <AnswerContext.Provider value={answerContext}>
      <div class="flex flex-col gap-2">
        <Index each={props.chunks}>
          {(chunk) => (
            <ViewNode
              spec={chunk() as ViewNodeProps['spec']}
              onGraphClick={props.onGraphClick}
              onDrawSubmit={props.onDrawSubmit}
            />
          )}
        </Index>
        <Show when={!props.streaming && identifiers().length > 0}>
          <button
            data-testid="answerbox-submit"
            class="self-start text-xs py-1.5 px-3.5 border-none rounded bg-blue-600 text-white cursor-pointer font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            disabled={identifiers().some((id) => !(answers[id] ?? '').trim())}
            onClick={() => props.onAnswerSubmit?.({ ...answers })}
          >
            Submit
          </button>
        </Show>
      </div>
    </AnswerContext.Provider>
  );
};

export default ChalkSpecRenderer;
