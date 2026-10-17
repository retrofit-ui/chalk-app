import { type Component, For, Show, createMemo, createSignal } from 'solid-js';
import type { ChalkAutomatonSpec } from '../spec';
import StateDiagram, { ACCENT, BAD, GOOD, MUTED } from './StateDiagram';
import FramePlayer from './FramePlayer';
import SpecErrors from './SpecErrors';
import { labeller } from './labels';
import { alphabet, isDeterministic, runAutomaton, tokenize, validateAutomaton } from './automaton';

// The classic simulator: an input tape with a read head, the current state(s) lit up, and
// an accept/reject verdict. An NFA lights several states at once — "a finger on every
// state you could be in".

const symbolLabel = (symbols: string[]) => symbols.map((s) => (s === '' ? 'ε' : s)).join(', ');

const AutomatonView: Component<{ spec: ChalkAutomatonSpec }> = (props) => {
  const errors = createMemo(() => validateAutomaton(props.spec));
  return (
    <div data-kind="chalk-automaton" class="my-2 flex flex-col gap-2">
      <Show when={props.spec.title}>
        <div class="text-sm font-semibold text-slate-700">{props.spec.title}</div>
      </Show>
      <Show when={errors().length === 0} fallback={<SpecErrors kind="automaton" errors={errors()} />}>
        <AutomatonBody spec={props.spec} />
      </Show>
    </div>
  );
};

const AutomatonBody: Component<{ spec: ChalkAutomatonSpec }> = (props) => {
  const [text, setText] = createSignal(props.spec.input ?? props.spec.examples?.[0] ?? '');
  const [index, setIndex] = createSignal(0);
  const tokens = createMemo(() => tokenize(props.spec, text()));
  const frames = createMemo(() => runAutomaton(props.spec, tokens()));
  const frame = () => frames()[Math.min(index(), frames().length - 1)];
  const deterministic = createMemo(() => isDeterministic(props.spec));
  const sigma = createMemo(() => alphabet(props.spec));
  const words = () => sigma().some((s) => s.length > 1);
  const accepting = createMemo(() => new Set(props.spec.states.filter((s) => s.accept).map((s) => s.id)));
  const name = (id: string) => labeller(props.spec.states)(id);
  const finished = () => index() >= frames().length - 1;

  const setInput = (v: string) => {
    setText(v);
    setIndex(0);
  };

  const verdictColor = () => (frame().status === 'accepted' ? GOOD : frame().status === 'rejected' ? BAD : ACCENT);

  return (
    <>
      <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span class="px-1.5 py-0.5 rounded bg-slate-100 font-semibold" data-testid="automaton-type">
          {deterministic() ? 'DFA' : 'NFA'}
        </span>
        <span>
          alphabet <span class="font-mono">{'{'}{sigma().join(', ')}{'}'}</span>
        </span>
      </div>

      <StateDiagram
        states={props.spec.states}
        edges={props.spec.transitions.map((t) => ({ from: t.from, to: t.to, label: symbolLabel(t.symbols) }))}
        size={props.spec.size}
        start={props.spec.start}
        accepting={accepting()}
        node={(id) => {
          const on = frame().active.includes(id);
          if (!on) return {};
          const c = finished() ? verdictColor() : ACCENT;
          return { fill: `${c}22`, stroke: c, strokeWidth: 3 };
        }}
        edge={(i) => (frame().fired.includes(i) ? { stroke: ACCENT, width: 3 } : { stroke: MUTED })}
      />

      <div class="flex flex-wrap items-center gap-2">
        <input
          data-testid="automaton-input"
          class="text-sm font-mono py-1 px-2 border border-slate-300 rounded-md w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={text()}
          placeholder={words() ? 'e.g. coin push' : 'type an input string'}
          onInput={(e) => setInput(e.currentTarget.value)}
        />
        <For each={props.spec.examples ?? []}>
          {(ex) => (
            <button
              class="text-xs font-mono px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100"
              data-testid="automaton-example"
              onClick={() => setInput(ex)}
            >
              {ex === '' ? 'ε (empty)' : ex}
            </button>
          )}
        </For>
      </div>

      <div class="flex flex-wrap items-center gap-1" data-testid="tape">
        <For each={tokens()}>
          {(tok, i) => {
            const read = () => i() < frame().consumed;
            const head = () => i() === frame().consumed && !finished();
            return (
              <span
                data-testid="tape-cell"
                data-read={read() ? 'true' : 'false'}
                class="font-mono text-sm min-w-7 text-center px-1.5 py-0.5 border rounded"
                classList={{
                  'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-300': head(),
                  'border-slate-200 text-slate-400': read(),
                  'border-slate-300 text-slate-800': !read() && !head(),
                }}
              >
                {tok}
              </span>
            );
          }}
        </For>
        <Show when={tokens().length === 0}>
          <span class="text-xs text-slate-400 italic">empty input (ε)</span>
        </Show>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <FramePlayer count={frames().length} index={index()} onIndex={setIndex} stepLabel="symbol" playMs={650} />
        <span class="text-xs text-slate-600" data-testid="automaton-status">
          <Show
            when={finished()}
            fallback={
              <>
                in <span class="font-mono font-semibold">{'{'}{frame().active.map(name).join(', ')}{'}'}</span>
              </>
            }
          >
            <span class="font-semibold" style={{ color: verdictColor() }}>
              {frame().status === 'accepted' ? '✓ Accepted' : '✗ Rejected'}
            </span>
            <Show when={frame().active.length === 0}>
              {' '}— no move for “{tokens()[frame().consumed - 1] ?? ''}”, the machine is stuck
            </Show>
            <Show when={frame().active.length > 0}>
              {' '}— ended in <span class="font-mono">{'{'}{frame().active.map(name).join(', ')}{'}'}</span>
            </Show>
          </Show>
        </span>
      </div>
    </>
  );
};

export default AutomatonView;
