import { type Component } from 'solid-js';
import type { HarnessProps } from '../types';
import type { ChalkViewSpec } from './spec';
import ChalkSpecRenderer from './ChalkSpecRenderer';
import styles from './harness.module.css';

const CHALK_SPEC_FENCE = /```chalk-spec\n([\s\S]*?)\n```/g;

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
  if (tail.trim()) {
    chunks.push({ kind: 'markdown', content: tail });
  }

  return chunks;
}

const GraphClickEvent: Component<{ points: Array<{ x: number; y: number }> }> = (props) => (
  <div class={styles.graphClickEvent}>
    <span class={styles.graphClickIcon}>⊕</span>
    <span>
      {props.points.length === 1
        ? `clicked (${props.points[0].x}, ${props.points[0].y})`
        : `clicked ${props.points.length} points: ${props.points.map(p => `(${p.x}, ${p.y})`).join(', ')}`}
    </span>
  </div>
);

const DrawSubmissionEvent: Component<{ imageBase64: string }> = (props) => (
  <div class={styles.drawSubmission}>
    <img
      class={styles.drawThumbnail}
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
  if (props.message.role === 'user') {
    return <div class={styles.userContent}>{props.message.content as string}</div>;
  }
  return (
    <ChalkSpecRenderer
      chunks={parseChunks(props.message.content as string)}
      onGraphClick={props.onGraphClick}
      onDrawSubmit={props.onDrawSubmit}
    />
  );
};

export default Harness;
