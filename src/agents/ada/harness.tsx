import type { Component } from 'solid-js';
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

const Harness: Component<HarnessProps> = (props) => {
  if (props.message.role === 'user') {
    return <div class={styles.userContent}>{props.message.content}</div>;
  }
  return <ChalkSpecRenderer chunks={parseChunks(props.message.content)} />;
};

export default Harness;
