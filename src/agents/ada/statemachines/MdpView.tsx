import { type Component, For, Show, createEffect, createMemo, createSignal, on } from 'solid-js';
import type { ChalkMdpSpec } from '../spec';
import StateDiagram, { GOOD, INK, MUTED } from './StateDiagram';
import FramePlayer from './FramePlayer';
import SpecErrors from './SpecErrors';
import { cellRgb, rgbToCss, textColor } from '../colorScale';
import { labeller } from './labels';
import { bellmanBackup, valueIteration, validateMdp } from './mdp';

// "Best path when the world is random": value iteration sweep by sweep. Each state's colour
// is its value, the chosen action's arrows are drawn bold green (the policy), a γ slider
// trades now against later, and hovering a state spells out its Bellman backup term by term
// — the same "hover to see the arithmetic" move as chalk-matmul.

const num = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
const compact = (v: number) => String(Number(v.toFixed(2)));
const signed = (v: number) => (v >= 0 ? `+${compact(v)}` : `−${compact(-v)}`);

const MdpView: Component<{ spec: ChalkMdpSpec }> = (props) => {
  const errors = createMemo(() => validateMdp(props.spec));
  return (
    <div data-kind="chalk-mdp" class="my-2 flex flex-col gap-2">
      <Show when={props.spec.title}>
        <div class="text-sm font-semibold text-slate-700">{props.spec.title}</div>
      </Show>
      <Show when={errors().length === 0} fallback={<SpecErrors kind="MDP" errors={errors()} />}>
        <MdpBody spec={props.spec} />
      </Show>
    </div>
  );
};

const MdpBody: Component<{ spec: ChalkMdpSpec }> = (props) => {
  const [gamma, setGamma] = createSignal(props.spec.gamma ?? 0.9);
  const [index, setIndex] = createSignal(0);
  const [focus, setFocus] = createSignal<string | null>(null);
  const frames = createMemo(() => valueIteration(props.spec, gamma(), { maxSweeps: 300 }));
  const frame = () => frames()[Math.min(index(), frames().length - 1)];
  const prevV = () => frames()[Math.max(0, Math.min(index(), frames().length - 1) - 1)].V;
  const converged = () => frames().at(-1)!.delta < 1e-6;

  // keep the sweep position when γ moves, unless it now runs past the end
  createEffect(on(frames, (f) => setIndex((i) => Math.min(i, f.length - 1)), { defer: true }));

  // one drawn edge per (action, outcome)
  const edges = createMemo(() =>
    props.spec.actions.flatMap((a, ai) =>
      a.outcomes.map((o) => ({
        action: ai,
        from: a.from,
        to: o.to,
        label: `${a.name}${a.outcomes.length > 1 ? ` ${o.p}` : ''}${o.reward ? ` (${signed(o.reward)})` : ''}`,
      })),
    ),
  );

  const range = createMemo(() => {
    const vs = Object.values(frames().at(-1)!.V);
    return { min: Math.min(0, ...vs), max: Math.max(0, ...vs) };
  });
  const scale = () => (range().min < 0 ? 'diverging' : 'sequential');
  const terminal = (id: string) => props.spec.states.find((s) => s.id === id)?.terminal;

  const backups = createMemo(() => {
    const id = focus();
    if (!id) return [];
    return props.spec.actions
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.from === id)
      .map(({ a, i }) => ({ name: a.name, index: i, ...bellmanBackup(props.spec, prevV(), i, gamma()) }));
  });

  return (
    <>
      <StateDiagram
        states={props.spec.states}
        edges={edges()}
        size={props.spec.size}
        accepting={new Set(props.spec.states.filter((s) => s.terminal).map((s) => s.id))}
        onNodeEnter={setFocus}
        onNodeLeave={() => setFocus(null)}
        onNodeClick={(id) => setFocus((f) => (f === id ? null : id))}
        node={(id) => {
          const rgb = cellRgb(frame().V[id] ?? 0, range().min, range().max, scale());
          return { fill: rgbToCss(rgb), text: textColor(rgb), stroke: focus() === id ? '#0f172a' : undefined, strokeWidth: focus() === id ? 3 : undefined };
        }}
        caption={(id) => (terminal(id) ? 'end' : `V=${num(frame().V[id] ?? 0)}`)}
        edge={(k) => {
          const e = edges()[k];
          if (frame().policy[e.from] === e.action) return { stroke: GOOD, width: 3.5, labelColor: GOOD };
          if (frame().sweep === 0) return { stroke: MUTED };
          return { stroke: MUTED, opacity: 0.55 };
        }}
      />

      <div class="flex flex-wrap items-center gap-4">
        <FramePlayer count={frames().length} index={index()} onIndex={setIndex} stepLabel="sweep" playMs={600} />
        <label class="text-xs flex items-center gap-2 text-slate-600">
          γ
          <input
            type="range"
            min="0"
            max="0.99"
            step="0.01"
            value={gamma()}
            data-testid="mdp-gamma"
            onInput={(e) => setGamma(Number(e.currentTarget.value))}
          />
          <span class="font-mono tabular-nums w-8">{gamma().toFixed(2)}</span>
        </label>
      </div>

      <div class="text-xs text-slate-600" data-testid="mdp-status">
        <Show when={frame().sweep > 0} fallback={<>All values start at 0. Step to apply the Bellman update to every state at once.</>}>
          Sweep {frame().sweep}: largest change {num(frame().delta)}
          <Show when={index() >= frames().length - 1}>
            {converged() ? ' — converged, this is the optimal policy.' : ' — stopped before converging.'}
          </Show>
        </Show>
      </div>

      <div class="text-xs" data-testid="mdp-policy">
        <span class="text-slate-500">Policy: </span>
        <For each={props.spec.states.filter((s) => frame().policy[s.id] !== null && frame().policy[s.id] !== undefined)}>
          {(s, i) => (
            <span class="font-mono">
              {i() > 0 ? ', ' : ''}
              {s.label ?? s.id} → <span style={{ color: GOOD }}>{props.spec.actions[frame().policy[s.id]!].name}</span>
            </span>
          )}
        </For>
        <Show when={frame().sweep === 0}>
          <span class="text-slate-400 italic">none yet</span>
        </Show>
      </div>

      <Show
        when={focus() && !terminal(focus()!) && frame().sweep > 0}
        fallback={<div class="text-xs text-slate-400">Hover a state to see its Bellman update.</div>}
      >
        <div class="text-xs rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5" data-testid="mdp-backup">
          <div class="text-slate-500 mb-0.5">
            V<sub>{frame().sweep}</sub>({labeller(props.spec.states)(focus()!)}) = max over actions of Σ p·(r + γ·V<sub>{frame().sweep - 1}</sub>(next))
          </div>
          <For each={backups()}>
            {(b) => (
              <div class="font-mono" classList={{ 'font-semibold': frame().policy[focus()!] === b.index }} style={{ color: frame().policy[focus()!] === b.index ? GOOD : INK }}>
                Q({b.name}) ={' '}
                {b.terms.map((t) => `${t.p}·(${compact(t.reward)} + ${gamma().toFixed(2)}·${num(t.nextValue)})`).join(' + ')} = {num(b.total)}
                {frame().policy[focus()!] === b.index ? '  ★' : ''}
              </div>
            )}
          </For>
        </div>
      </Show>
    </>
  );
};

export default MdpView;
