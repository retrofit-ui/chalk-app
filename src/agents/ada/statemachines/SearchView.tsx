import { type Component, For, Show, createEffect, createMemo, createSignal, on } from 'solid-js';
import type { ChalkSearchSpec, SearchAlgorithm } from '../spec';
import StateDiagram, { ACCENT, BAD, GOOD, INK, MUTED, WARM } from './StateDiagram';
import FramePlayer from './FramePlayer';
import SpecErrors from './SpecErrors';
import { labeller } from './labels';
import { ALGORITHMS, ALGORITHM_NAMES, checkHeuristic, costToGoal, defaultAlgorithm, runSearch, validateSearch } from './search';

// "Same loop, different queue": the student flips between BFS, Dijkstra, greedy and A* on
// one graph and watches the frontier (the ripple's edge) grow, with the queue itself on
// screen in pop order. A table underneath compares how much each algorithm explored and
// what its path cost — and a heuristic check calls out an h that overestimates.

const PRIORITY_KEY: Record<SearchAlgorithm, string> = { bfs: 'arrival', dijkstra: 'g', greedy: 'h', astar: 'f = g + h' };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const SearchView: Component<{ spec: ChalkSearchSpec }> = (props) => {
  const errors = createMemo(() => validateSearch(props.spec));
  return (
    <div data-kind="chalk-search" class="my-2 flex flex-col gap-2">
      <Show when={props.spec.title}>
        <div class="text-sm font-semibold text-slate-700">{props.spec.title}</div>
      </Show>
      <Show when={errors().length === 0} fallback={<SpecErrors kind="search" errors={errors()} />}>
        <SearchBody spec={props.spec} />
      </Show>
    </div>
  );
};

const SearchBody: Component<{ spec: ChalkSearchSpec }> = (props) => {
  const [costs, setCosts] = createSignal(props.spec.edges.map((e) => e.cost ?? 1));
  const [hs, setHs] = createSignal(props.spec.states.map((s) => s.h));
  const live = createMemo<ChalkSearchSpec>(() => ({
    ...props.spec,
    edges: props.spec.edges.map((e, i) => ({ ...e, cost: costs()[i] })),
    states: props.spec.states.map((s, i) => ({ ...s, h: hs()[i] })),
  }));

  const offered = () => props.spec.algorithms?.filter((a) => ALGORITHMS.includes(a)) ?? ALGORITHMS;
  const [algorithm, setAlgorithm] = createSignal<SearchAlgorithm>(props.spec.algorithm ?? defaultAlgorithm(props.spec));
  const [index, setIndex] = createSignal(0);
  const frames = createMemo(() => runSearch(live(), algorithm()));
  const frame = () => frames()[Math.min(index(), frames().length - 1)];
  const usesH = () => live().states.some((s) => typeof s.h === 'number');
  const optimal = createMemo(() => costToGoal(live())[live().start]);
  const heuristic = createMemo(() => (usesH() ? checkHeuristic(live()) : { overestimates: [], inconsistent: [] }));
  const compare = createMemo(() =>
    offered().map((a) => {
      const last = runSearch(live(), a).at(-1)!;
      return { a, expanded: last.closed.length, cost: last.pathCost };
    }),
  );

  // any change to the inputs restarts playback from the first frame
  createEffect(on([algorithm, live], () => setIndex(0), { defer: true }));

  const onPath = (from: string, to: string) => {
    const p = frame().path;
    if (!p) return false;
    for (let k = 1; k < p.length; k++) {
      if (p[k - 1] === from && p[k] === to) return true;
      if (props.spec.directed === false && p[k - 1] === to && p[k] === from) return true;
    }
    return false;
  };

  const name = (id: string) => labeller(props.spec.states)(id);
  const inFrontier = (id: string) => frame().frontier.some((e) => e.id === id);

  return (
    <>
      <div class="flex flex-wrap items-center gap-1" data-testid="algorithm-picker">
        <For each={offered()}>
          {(a) => (
            <button
              data-testid={`algorithm-${a}`}
              aria-pressed={algorithm() === a}
              class="text-xs px-2.5 py-1 rounded border"
              classList={{
                'bg-slate-800 text-white border-slate-800': algorithm() === a,
                'bg-white text-slate-700 border-slate-300 hover:bg-slate-50': algorithm() !== a,
              }}
              onClick={() => setAlgorithm(a)}
            >
              {ALGORITHM_NAMES[a]}
            </button>
          )}
        </For>
        <span class="text-xs text-slate-500 ml-2">frontier ordered by <span class="font-mono">{PRIORITY_KEY[algorithm()]}</span></span>
      </div>

      <StateDiagram
        states={live().states}
        edges={live().edges.map((e) => ({ from: e.from, to: e.to, label: e.label ?? fmt(e.cost ?? 1) }))}
        size={props.spec.size}
        start={props.spec.start}
        accepting={new Set([props.spec.goal])}
        node={(id) => {
          if (frame().path?.includes(id)) return { fill: `${GOOD}22`, stroke: GOOD, strokeWidth: 3 };
          if (frame().expanded === id) return { fill: `${ACCENT}33`, stroke: ACCENT, strokeWidth: 3 };
          if (frame().closed.includes(id)) return { fill: '#e2e8f0', stroke: INK };
          if (inFrontier(id)) return { fill: `${WARM}1f`, stroke: WARM, strokeWidth: 2.5 };
          return { opacity: 0.75 };
        }}
        caption={(id) => {
          const g = frame().g[id];
          const h = live().states.find((s) => s.id === id)?.h;
          const parts: string[] = [];
          if (g !== undefined) parts.push(`g=${fmt(g)}`);
          if (usesH() && h !== undefined) parts.push(`h=${fmt(h)}`);
          return parts.length ? parts.join(' ') : undefined;
        }}
        edge={(i) => {
          const e = live().edges[i];
          if (onPath(e.from, e.to)) return { stroke: GOOD, width: 3.5 };
          if (frame().examined.includes(i)) return { stroke: ACCENT, width: 2.5 };
          if (heuristic().inconsistent.includes(i)) return { stroke: BAD, dashed: true, labelColor: BAD };
          return { stroke: MUTED };
        }}
      />

      <div class="flex flex-wrap items-start gap-4">
        <div class="flex flex-col gap-1.5">
          <FramePlayer count={frames().length} index={index()} onIndex={setIndex} stepLabel="expansion" playMs={800} />
          <div class="text-xs text-slate-600" data-testid="search-status">
            <Show when={frame().expanded} fallback={<>Start: only <span class="font-mono">{name(props.spec.start)}</span> is on the frontier.</>}>
              Expanded <span class="font-mono font-semibold">{name(frame().expanded!)}</span>
              <Show when={frame().done && frame().path}> — reached the goal.</Show>
              <Show when={frame().done && !frame().path}> — frontier empty, the goal is unreachable.</Show>
            </Show>
          </div>
          <Show when={frame().path}>
            {(path) => (
              <div class="text-xs" data-testid="search-path">
                Path <span class="font-mono font-semibold">{path().map(name).join(' → ')}</span>, cost{' '}
                <span class="font-semibold tabular-nums">{fmt(frame().pathCost!)}</span>
                <Show
                  when={Math.abs(frame().pathCost! - optimal()) < 1e-9}
                  fallback={<span class="ml-1" style={{ color: BAD }}>(not optimal; the cheapest costs {fmt(optimal())})</span>}
                >
                  <span class="ml-1" style={{ color: GOOD }}>(optimal)</span>
                </Show>
              </div>
            )}
          </Show>
        </div>

        <div class="text-xs min-w-40" data-testid="frontier">
          <div class="font-semibold text-slate-700 mb-0.5">Frontier (next to pop first)</div>
          <Show when={frame().frontier.length > 0} fallback={<div class="text-slate-400 italic">empty</div>}>
            <ol class="flex flex-col gap-0.5">
              <For each={frame().frontier}>
                {(e, i) => (
                  <li class="font-mono flex gap-2" data-testid="frontier-entry">
                    <span class="text-slate-400 w-4 text-right">{i() + 1}.</span>
                    <span class="font-semibold min-w-8 pr-1 whitespace-nowrap" style={{ color: WARM }}>{name(e.id)}</span>
                    <span class="text-slate-500">
                      {algorithm() === 'astar' ? `f=${fmt(e.g)}+${fmt(e.h)}=${fmt(e.f)}` : algorithm() === 'greedy' ? `h=${fmt(e.h)}` : `g=${fmt(e.g)}`}
                    </span>
                  </li>
                )}
              </For>
            </ol>
          </Show>
          <div class="mt-1 text-slate-500">
            Expanded: <span class="font-mono">{frame().closed.map(name).join(', ') || '—'}</span>
          </div>
        </div>
      </div>

      <Show when={heuristic().overestimates.length > 0 || heuristic().inconsistent.length > 0}>
        <div class="text-xs rounded border border-red-200 bg-red-50 text-red-900 px-2.5 py-1.5" data-testid="heuristic-warning">
          <Show when={heuristic().overestimates.length > 0}>
            <div>
              <span class="font-semibold">h overestimates</span> at{' '}
              <For each={heuristic().overestimates}>
                {(o, i) => (
                  <span class="font-mono">
                    {i() > 0 ? ', ' : ''}
                    {name(o.id)} (h={fmt(o.h)}, true cost {fmt(o.trueCost)})
                  </span>
                )}
              </For>
              , so A* may return a costlier path.
            </div>
          </Show>
          <Show when={heuristic().inconsistent.length > 0}>
            <div>
              <span class="font-semibold">Inconsistent</span> on the dashed red edges: h drops by more than the edge costs.
            </div>
          </Show>
        </div>
      </Show>

      <table class="text-xs border-collapse self-start" data-testid="algorithm-compare">
        <thead>
          <tr class="text-slate-500">
            <th class="text-left font-medium pr-4">algorithm</th>
            <th class="text-right font-medium pr-4">states expanded</th>
            <th class="text-right font-medium">path cost</th>
          </tr>
        </thead>
        <tbody>
          <For each={compare()}>
            {(row) => (
              <tr classList={{ 'font-semibold': row.a === algorithm() }}>
                <td class="pr-4">{ALGORITHM_NAMES[row.a]}</td>
                <td class="text-right pr-4 tabular-nums">{row.expanded}</td>
                <td class="text-right tabular-nums" style={{ color: row.cost !== null && Math.abs(row.cost - optimal()) > 1e-9 ? BAD : undefined }}>
                  {row.cost === null ? '—' : fmt(row.cost)}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>

      <Show when={props.spec.editable}>
        <details class="text-xs" data-testid="search-edit">
          <summary class="cursor-pointer text-slate-600">Edit costs{usesH() ? ' and h' : ''}</summary>
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <For each={props.spec.edges}>
              {(e, i) => (
                <label class="flex items-center gap-1 font-mono">
                  {name(e.from)}→{name(e.to)}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    class="w-14 px-1 py-0.5 border border-slate-300 rounded"
                    value={costs()[i()]}
                    data-testid="edit-cost"
                    onInput={(ev) => {
                      const v = Number(ev.currentTarget.value);
                      if (Number.isFinite(v) && v >= 0) setCosts((c) => c.map((x, k) => (k === i() ? v : x)));
                    }}
                  />
                </label>
              )}
            </For>
            <Show when={usesH()}>
              <For each={props.spec.states}>
                {(s, i) => (
                  <label class="flex items-center gap-1 font-mono">
                    h({name(s.id)})
                    <input
                      type="number"
                      min="0"
                      step="1"
                      class="w-14 px-1 py-0.5 border border-slate-300 rounded"
                      value={hs()[i()] ?? 0}
                      data-testid="edit-h"
                      onInput={(ev) => {
                        const v = Number(ev.currentTarget.value);
                        if (Number.isFinite(v) && v >= 0) setHs((h) => h.map((x, k) => (k === i() ? v : x)));
                      }}
                    />
                  </label>
                )}
              </For>
            </Show>
          </div>
        </details>
      </Show>
    </>
  );
};

export default SearchView;
