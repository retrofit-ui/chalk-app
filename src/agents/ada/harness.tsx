import { type Component, For, Show } from 'solid-js';
import type { HarnessProps } from '../types';
import ChalkSpecRenderer from './ChalkSpecRenderer';
import { findPreviousAnswers, parseChunks } from './chunkParser';

export { findPreviousAnswers, parseChunks };

const GraphClickEvent: Component<{ points: Array<{ x: number; y: number }> }> = (props) => (
  <div class="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-300 rounded-lg py-1 px-2.5 font-mono self-start">
    <span class="text-sm text-slate-500">⊕</span>
    <span>
      {props.points.length === 1
        ? `clicked (${props.points[0].x}, ${props.points[0].y})`
        : `clicked ${props.points.length} points: ${props.points.map(p => `(${p.x}, ${p.y})`).join(', ')}`}
    </span>
  </div>
);

const AnswerSubmitEvent: Component<{
  answers: Record<string, string>;
  previousAnswers?: Record<string, string>;
}> = (props) => {
  const summary = () =>
    Object.entries(props.answers).map(([id, value]) => `${id}=${value}`).join(', ');
  const changes = () => {
    const prev = props.previousAnswers;
    if (!prev) return [];
    return Object.entries(props.answers)
      .filter(([id, value]) => prev[id] !== undefined && prev[id] !== value)
      .map(([id, value]) => `${id}: ${prev[id]}→${value}`);
  };

  return (
    <details class="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-lg py-1.5 px-2.5 font-mono self-start">
      <summary class="cursor-pointer">
        User answered: {summary()}
        <Show when={changes().length > 0}> (changed {changes().join(', ')})</Show>
      </summary>
      <div class="flex flex-col gap-1 mt-1.5 pt-1.5 border-t border-slate-200">
        <For each={Object.entries(props.answers)}>
          {([identifier, value]) => <span>{identifier}: {value}</span>}
        </For>
      </div>
    </details>
  );
};

const ToolUseEvent: Component<{ calls: Array<{ id: string; name: string; input: unknown }> }> = (props) => {
  const kinds = () => {
    const all = props.calls.flatMap((c) => {
      const input = c.input as { kinds?: unknown } | undefined;
      return Array.isArray(input?.kinds) ? (input.kinds as string[]) : [c.name];
    });
    return [...new Set(all)];
  };

  return (
    <div class="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-300 rounded-lg py-1 px-2.5 font-mono self-start">
      <span class="text-sm text-slate-500">🔎</span>
      <span>looked up: {kinds().join(', ')}</span>
    </div>
  );
};

const DrawSubmissionEvent: Component<{ imageBase64: string }> = (props) => (
  <div class="inline-block border border-slate-200 rounded-lg overflow-hidden self-start">
    <img
      class="block max-w-80 max-h-56 w-full"
      src={`data:image/png;base64,${props.imageBase64}`}
      alt="Student drawing"
    />
  </div>
);

const Harness: Component<HarnessProps> = (props) => {
  if (props.message.kind === 'graph-click' && props.message.graphClickData) {
    return <GraphClickEvent points={props.message.graphClickData.points} />;
  }
  if (props.message.kind === 'draw-submission' && props.message.drawSubmissionData) {
    return <DrawSubmissionEvent imageBase64={props.message.drawSubmissionData.imageBase64} />;
  }
  if (props.message.kind === 'tool-use' && props.message.toolUseData) {
    return <ToolUseEvent calls={props.message.toolUseData.calls} />;
  }
  if (props.message.kind === 'answer-submit' && props.message.answerData) {
    return (
      <AnswerSubmitEvent
        answers={props.message.answerData.answers}
        previousAnswers={props.previousAnswers}
      />
    );
  }
  if (props.message.role === 'user') {
    return (
      <div class="whitespace-pre-wrap leading-relaxed text-sm bg-indigo-50 border border-indigo-100 text-indigo-950 py-2.5 px-3.5 rounded-xl self-start">
        {props.message.content as string}
      </div>
    );
  }
  return (
    <ChalkSpecRenderer
      chunks={parseChunks(props.message.content as string)}
      onGraphClick={props.onGraphClick}
      onDrawSubmit={props.onDrawSubmit}
      onAnswerSubmit={props.onAnswerSubmit}
    />
  );
};

export default Harness;
