import { type Component, For } from 'solid-js';
import type { HarnessProps } from '../types';
import type { ChalkViewSpec } from './spec';
import ChalkSpecRenderer from './ChalkSpecRenderer';

const CHALK_SPEC_FENCE = /```chalk-spec\n([\s\S]*?)\n```/g;
const CHALK_SPEC_OPENER = '```chalk-spec';

function parseChunks(content: string): ChalkViewSpec[] {
  const chunks: ChalkViewSpec[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(CHALK_SPEC_FENCE)) {
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) {
      chunks.push({ kind: 'markdown', content: before });
    }

    try {
      const spec = JSON.parse(match[1]) as ChalkViewSpec;
      chunks.push(spec);
    } catch {
      chunks.push({ kind: 'markdown', content: `\`\`\`\n${match[1]}\n\`\`\`` });
    }

    lastIndex = match.index! + match[0].length;
  }

  const tail = content.slice(lastIndex);
  const unclosedIdx = tail.indexOf(CHALK_SPEC_OPENER);
  if (unclosedIdx !== -1) {
    const preFence = tail.slice(0, unclosedIdx);
    if (preFence.trim()) {
      chunks.push({ kind: 'markdown', content: preFence });
    }
    const partialBody = tail.slice(unclosedIdx + CHALK_SPEC_OPENER.length).replace(/^\n/, '');
    chunks.push({
      kind: 'markdown',
      content:
        `> ⚠️ **Truncated \`chalk-spec\` block** — the response was cut off mid-generation. ` +
        `The partial JSON body is shown below.\n\n\`\`\`json\n${partialBody}\n\`\`\``,
    });
  } else if (tail.trim()) {
    chunks.push({ kind: 'markdown', content: tail });
  }

  return chunks;
}

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

const AnswerSubmitEvent: Component<{ answers: Record<string, string> }> = (props) => (
  <div class="inline-flex flex-col gap-1 text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-lg py-1.5 px-2.5 font-mono self-start">
    <For each={Object.entries(props.answers)}>
      {([identifier, value]) => <span>{identifier}: {value}</span>}
    </For>
  </div>
);

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
  if (props.message.kind === 'answer-submit' && props.message.answerData) {
    return <AnswerSubmitEvent answers={props.message.answerData.answers} />;
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
