import { type Component, For, Show, createEffect, createMemo, createSignal, on } from 'solid-js';
import type { ChalkMarkovSpec, MarkovTransition } from '../spec';
import StateDiagram, { ACCENT, INK, MUTED, WARM } from './StateDiagram';
import FramePlayer from './FramePlayer';
import SpecErrors from './SpecErrors';
import { labeller } from './labels';
import { absorptionAnalysis, distributionAt, longRunDistribution, sampleWalk, setProbability, transitionMatrix, validateMarkov } from './markov';

// Setosa-style: a token hops between states, visit counts build up next to the true
// long-run distribution (the law of large numbers, live), and the transition matrix sits
// beside the diagram — hover a row to light up that state's outgoing arrows. A second
// mode shows the whole distribution flowing: π after n steps, as fill.

const WALK_STEPS = 400;
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 1 : 0)}%`;
const prob = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/^0/, ''));

const MarkovView: Component<{ spec: ChalkMarkovSpec }> = (props) => {
  const errors = createMemo(() => validateMarkov(props.spec));
  return (
    <div data-kind="chalk-markov" class="my-2 flex flex-col gap-2">
      <Show when={props.spec.title}>
        <div class="text-sm font-semibold text-slate-700">{props.spec.title}</div>
      </Show>
      <Show when={errors().length === 0} fallback={<SpecErrors kind="Markov chain" errors={errors()} />}>
        <MarkovBody spec={props.spec} />
      </Show>
    </div>
  );
};

const MarkovBody: Component<{ spec: ChalkMarkovSpec }> = (props) => {
  const [transitions, setTransitions] = createSignal<MarkovTransition[]>(props.spec.transitions);
  const live = createMemo<ChalkMarkovSpec>(() => ({ ...props.spec, transitions: transitions() }));
  const ids = () => props.spec.states.map((s) => s.id);
  const [start, setStart] = createSignal(props.spec.start ?? props.spec.states[0].id);
  const [mode, setMode] = createSignal<'walk' | 'flow'>('walk');
  const [index, setIndex] = createSignal(0);
  const [n, setN] = createSignal(0);
  const [hoverRow, setHoverRow] = createSignal<string | null>(null);

  const P = createMemo(() => transitionMatrix(live()));
  const startIdx = () => Math.max(0, ids().indexOf(start()));
  const pi0 = () => ids().map((_, i) => (i === startIdx() ? 1 : 0));
  const walk = createMemo(() => sampleWalk(P(), startIdx(), WALK_STEPS, props.spec.seed ?? 1));
  const longRun = createMemo(() => longRunDistribution(P(), pi0()));
  const piN = createMemo(() => distributionAt(P(), pi0(), n()));
  const absorption = createMemo(() => absorptionAnalysis(P()));

  createEffect(on([P, start], () => setIndex(0), { defer: true }));

  const at = () => walk()[Math.min(index(), walk().length - 1)];
  const visits = createMemo(() => {
    const counts = ids().map(() => 0);
    for (const s of walk().slice(0, index() + 1)) counts[s]++;
    return counts;
  });
  const visitShare = (i: number) => visits()[i] / (index() + 1);
  const lastHop = () => (index() > 0 ? [walk()[index() - 1], walk()[index()]] : null);

  const nodeShare = (i: number) => (mode() === 'flow' ? piN()[i] : visitShare(i));

  return (
    <>
      <div class="flex flex-wrap items-center gap-1">
        <For each={[['walk', 'Random walk'], ['flow', 'Distribution after n steps']] as const}>
          {([m, label]) => (
            <button
              data-testid={`markov-mode-${m}`}
              aria-pressed={mode() === m}
              class="text-xs px-2.5 py-1 rounded border"
              classList={{
                'bg-slate-800 text-white border-slate-800': mode() === m,
                'bg-white text-slate-700 border-slate-300 hover:bg-slate-50': mode() !== m,
              }}
              onClick={() => setMode(m)}
            >
              {label}
            </button>
          )}
        </For>
        <span class="text-xs text-slate-500 ml-2">click a state to start there</span>
      </div>

      <div class="flex flex-wrap items-start gap-4">
        <div class="min-w-0 max-w-full">
          <StateDiagram
            states={props.spec.states}
            edges={transitions().map((t) => ({ from: t.from, to: t.to, label: prob(t.p) }))}
            size={props.spec.size}
            start={start()}
            token={mode() === 'walk' ? ids()[at()] : null}
            onNodeClick={(id) => setStart(id)}
            node={(id) => {
              const i = ids().indexOf(id);
              const share = nodeShare(i);
              const look = { fill: `rgba(37, 99, 235, ${(0.08 + 0.6 * share).toFixed(3)})`, text: share > 0.55 ? 'white' : INK };
              if (mode() === 'walk' && i === at()) return { ...look, stroke: WARM, strokeWidth: 3 };
              return look;
            }}
            caption={(id) => {
              const i = ids().indexOf(id);
              return mode() === 'flow' ? pct(piN()[i]) : `${visits()[i]} visits`;
            }}
            edge={(k) => {
              const t = transitions()[k];
              if (t.p <= 0) return { stroke: MUTED, opacity: 0.25 };
              if (hoverRow() === t.from) return { stroke: ACCENT, width: 3 };
              const hop = lastHop();
              if (mode() === 'walk' && hop && ids()[hop[0]] === t.from && ids()[hop[1]] === t.to) return { stroke: WARM, width: 3 };
              return { stroke: MUTED, width: 1 + 2 * t.p };
            }}
          />
        </div>

        <Show when={props.spec.showMatrix ?? true}>
          <table class="text-xs border-collapse self-start" data-testid="markov-matrix">
            <thead>
              <tr>
                <th class="text-slate-400 font-normal px-1 text-right">from \ to</th>
                <For each={props.spec.states}>{(s) => <th class="font-semibold px-1.5 text-slate-700">{s.label ?? s.id}</th>}</For>
              </tr>
            </thead>
            <tbody>
              <For each={P()}>
                {(row, i) => (
                  <tr
                    class="cursor-default"
                    classList={{ 'bg-blue-50': hoverRow() === ids()[i()] }}
                    onMouseEnter={() => setHoverRow(ids()[i()])}
                    onMouseLeave={() => setHoverRow(null)}
                  >
                    <th class="font-semibold px-1 text-right text-slate-700">{props.spec.states[i()].label ?? ids()[i()]}</th>
                    <For each={row}>
                      {(v) => (
                        <td class="font-mono text-center px-1.5 py-0.5 tabular-nums" classList={{ 'text-slate-300': v === 0 }}>
                          {prob(v)}
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>

      <Show when={mode() === 'walk'}>
        <FramePlayer count={walk().length} index={index()} onIndex={setIndex} stepLabel="hop" playMs={320} />
        <div class="text-xs flex flex-col gap-1 max-w-md" data-testid="markov-visits">
          <div class="text-slate-500">
            Share of time in each state so far, against the long-run share <span class="inline-block w-3 border-t-2 border-slate-800 align-middle" />
          </div>
          <For each={props.spec.states}>
            {(s, i) => (
              <div class="flex items-center gap-2">
                <span class="w-16 truncate font-semibold text-slate-700">{s.label ?? s.id}</span>
                <div class="relative flex-1 h-3 bg-slate-100 rounded-sm">
                  <div class="absolute inset-y-0 left-0 bg-blue-500/70 rounded-sm" style={{ width: pct(visitShare(i())) }} />
                  <div class="absolute -inset-y-0.5 w-0.5 bg-slate-800" style={{ left: pct(longRun()[i()]) }} />
                </div>
                <span class="w-20 text-right tabular-nums text-slate-600">
                  {pct(visitShare(i()))} / {pct(longRun()[i()])}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={mode() === 'flow'}>
        <label class="text-xs flex items-center gap-2 text-slate-600">
          n =
          <input type="range" min="0" max="40" value={n()} data-testid="markov-n" onInput={(e) => setN(Number(e.currentTarget.value))} />
          <span class="tabular-nums font-mono w-6">{n()}</span>
          <span class="text-slate-400">π₀ starts all at {labeller(props.spec.states)(start())}; each step multiplies by P</span>
        </label>
        <div class="text-xs text-slate-600" data-testid="markov-distribution">
          π<sub>{n()}</sub> = (
          <For each={piN()}>{(v, i) => <span class="font-mono">{i() > 0 ? ', ' : ''}{v.toFixed(3)}</span>}</For>
          ) → long run (
          <For each={longRun()}>{(v, i) => <span class="font-mono">{i() > 0 ? ', ' : ''}{v.toFixed(3)}</span>}</For>)
        </div>
      </Show>

      <Show when={absorption().absorbing.length > 0}>
        <div class="text-xs" data-testid="markov-absorption">
          <div class="font-semibold text-slate-700">
            Absorbing: {absorption().absorbing.map((i) => props.spec.states[i].label ?? ids()[i]).join(', ')}
          </div>
          <table class="border-collapse mt-0.5">
            <thead>
              <tr class="text-slate-500">
                <th class="text-left font-medium pr-3">from</th>
                <th class="text-right font-medium pr-3">expected steps to absorb</th>
                <For each={absorption().absorbing}>
                  {(a) => <th class="text-right font-medium pr-3">P(end in {props.spec.states[a].label ?? ids()[a]})</th>}
                </For>
              </tr>
            </thead>
            <tbody>
              <For each={props.spec.states.map((s, i) => ({ s, i })).filter(({ i }) => !absorption().absorbing.includes(i))}>
                {({ s, i }) => (
                  <tr>
                    <td class="pr-3 font-semibold text-slate-700">{s.label ?? s.id}</td>
                    <td class="text-right pr-3 tabular-nums font-mono" data-testid="expected-steps">
                      {Number.isFinite(absorption().expectedSteps[i]) ? absorption().expectedSteps[i].toFixed(2) : '∞'}
                    </td>
                    <For each={absorption().absorbing}>
                      {(a) => (
                        <td class="text-right pr-3 tabular-nums font-mono">
                          {Number.isFinite(absorption().expectedSteps[i]) ? absorption().absorptionProbabilities[i][a].toFixed(3) : '—'}
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <Show when={props.spec.editable}>
        <details class="text-xs" data-testid="markov-edit">
          <summary class="cursor-pointer text-slate-600">Edit probabilities (each row rescales to stay at 1)</summary>
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <For each={transitions()}>
              {(t) => (
                <label class="flex items-center gap-1 font-mono">
                  {labeller(props.spec.states)(t.from)}→{labeller(props.spec.states)(t.to)}
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    class="w-16 px-1 py-0.5 border border-slate-300 rounded"
                    value={Number(t.p.toFixed(3))}
                    data-testid="edit-p"
                    onChange={(ev) => {
                      const v = Number(ev.currentTarget.value);
                      if (Number.isFinite(v)) setTransitions(setProbability(live(), t.from, t.to, v));
                    }}
                  />
                </label>
              )}
            </For>
          </div>
        </details>
      </Show>
    </>
  );
};

export default MarkovView;
