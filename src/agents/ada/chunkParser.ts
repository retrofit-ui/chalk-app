import type { ChatMessage } from '../../anthropic';
import type { ChalkViewSpec } from './spec';

export function findPreviousAnswers(
  messages: ChatMessage[],
  index: number,
): Record<string, string> | undefined {
  for (let i = index - 1; i >= 0; i--) {
    if (messages[i].kind === 'answer-submit' && messages[i].answerData) {
      return messages[i].answerData!.answers;
    }
  }
  return undefined;
}

const CHALK_SPEC_FENCE = /```chalk-spec\n([\s\S]*?)\n```/g;
const CHALK_SPEC_OPENER = '```chalk-spec';
// Trailing newlines are swallowed too so removing the fence doesn't leave a blank gap.
const CHALK_PLAN_FENCE = /```chalk-plan\n([\s\S]*?)\n```\n*/;

/**
 * Splits a fenced `chalk-plan` block (emitted by agents running without tools) out of a
 * reply. Only the first fence is taken; the remaining text is returned as `content`.
 */
export function extractPlan(content: string): { content: string; plan?: string } {
  const match = content.match(CHALK_PLAN_FENCE);
  if (!match || match.index === undefined) return { content, plan: undefined };
  const plan = match[1].trim();
  return {
    content: content.slice(0, match.index) + content.slice(match.index + match[0].length),
    plan: plan || undefined,
  };
}

export function parseChunks(content: string): ChalkViewSpec[] {
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
