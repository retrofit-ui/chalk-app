import { type Component, Show, createEffect, createSignal, onCleanup } from 'solid-js';

// Step / back / play controls over a precomputed list of engine frames. The engines do all
// the work up front, so "back" is free and every kind gets identical playback.

const btn =
  'text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed tabular-nums';

const FramePlayer: Component<{
  count: number;
  index: number;
  onIndex: (i: number) => void;
  stepLabel?: string; // e.g. "step", "sweep", "symbol"
  playMs?: number;
}> = (props) => {
  const [playing, setPlaying] = createSignal(false);
  const last = () => Math.max(0, props.count - 1);

  createEffect(() => {
    if (!playing()) return;
    const timer = setInterval(() => {
      if (props.index >= last()) {
        setPlaying(false);
        return;
      }
      props.onIndex(props.index + 1);
    }, props.playMs ?? 700);
    onCleanup(() => clearInterval(timer));
  });

  const togglePlay = () => {
    if (!playing() && props.index >= last()) props.onIndex(0);
    setPlaying((p) => !p);
  };

  return (
    <div class="flex flex-wrap items-center gap-1.5" data-testid="frame-player">
      <button class={btn} data-testid="player-reset" disabled={props.index === 0} onClick={() => { setPlaying(false); props.onIndex(0); }} title="Back to the start">
        ⏮
      </button>
      <button class={btn} data-testid="player-back" disabled={props.index === 0} onClick={() => { setPlaying(false); props.onIndex(props.index - 1); }} title="One step back">
        ◀
      </button>
      <button class={btn} data-testid="player-play" disabled={props.count <= 1} onClick={togglePlay} title={playing() ? 'Pause' : 'Play'}>
        {playing() ? '⏸' : '▶▶'}
      </button>
      <button class={btn} data-testid="player-step" disabled={props.index >= last()} onClick={() => { setPlaying(false); props.onIndex(props.index + 1); }} title="One step forward">
        ▶
      </button>
      <button class={btn} data-testid="player-end" disabled={props.index >= last()} onClick={() => { setPlaying(false); props.onIndex(last()); }} title="Jump to the end">
        ⏭
      </button>
      <Show when={props.count > 1}>
        <span class="text-xs text-slate-500 tabular-nums ml-1" data-testid="player-position">
          {props.stepLabel ?? 'step'} {props.index} / {last()}
        </span>
      </Show>
    </div>
  );
};

export default FramePlayer;
