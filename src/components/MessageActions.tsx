import { Show, type Component } from 'solid-js';

const btnClass =
  'rounded border border-gray-300 bg-transparent px-2 py-0.5 text-xs text-gray-500 leading-relaxed cursor-pointer hover:border-gray-400 hover:text-gray-700 hover:bg-gray-100';

type Props = {
  index: number;
  showingRaw: boolean;
  hasDebug?: boolean;
  showingDebug?: boolean;
  onFork: (index: number) => void;
  onRevert: (index: number) => void;
  onToggleRaw: (index: number) => void;
  onToggleDebug?: (index: number) => void;
};

const MessageActions: Component<Props> = (props) => {
  return (
    <div class="flex gap-1 mt-1">
      <button
        class={btnClass}
        title="Fork conversation from this message"
        onClick={() => props.onFork(props.index)}
      >
        ⎇ fork
      </button>
      <button
        class={btnClass}
        title="Revert conversation to this message"
        onClick={() => props.onRevert(props.index)}
      >
        ↩ revert
      </button>
      <button
        class={btnClass}
        title={props.showingRaw ? 'Show rendered content' : 'Show raw output'}
        onClick={() => props.onToggleRaw(props.index)}
      >
        {props.showingRaw ? '⌫ rendered' : '{} raw'}
      </button>
      <Show when={props.hasDebug}>
        <button
          class={btnClass}
          title={props.showingDebug ? 'Hide debug info' : 'Show debug info (usage, model, stop reason, etc.)'}
          onClick={() => props.onToggleDebug?.(props.index)}
        >
          {props.showingDebug ? '⌫ debug' : '🐞 debug'}
        </button>
      </Show>
    </div>
  );
};

export default MessageActions;
