import type { ChatMessage } from '../../anthropic';
import type { ChalkViewSpec } from './spec';
import { markIncomplete, parsePartialJson } from './partialJson';

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

/**
 * Splits an assistant message into markdown and chalk-spec chunks.
 *
 * An unclosed chalk-spec fence at the tail means one of two things. While the
 * reply is `streaming`, it is a spec still arriving: it is parsed leniently
 * (see partialJson.ts) into a renderable, incomplete spec. Once streaming has
 * stopped, the reply really was cut off, and a truncation warning is shown.
 */
export function parseChunks(content: string, { streaming = false } = {}): ChalkViewSpec[] {
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
    if (streaming) {
      chunks.push(parseStreamingSpec(partialBody));
      return chunks;
    }
    chunks.push({
      kind: 'markdown',
      content:
        `> ⚠️ **Truncated \`chalk-spec\` block** — the response was cut off mid-generation. ` +
        `The partial JSON body is shown below.\n\n\`\`\`json\n${partialBody}\n\`\`\``,
    });
  } else if (tail.trim()) {
    const text = streaming ? withoutPartialOpener(tail) : tail;
    if (text.trim()) chunks.push({ kind: 'markdown', content: text });
  }

  return chunks;
}

function parseStreamingSpec(body: string): ChalkViewSpec {
  try {
    const value = parsePartialJson(body);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as ChalkViewSpec;
    }
    // Nothing usable yet: an empty, incomplete node renders as a placeholder.
    return markIncomplete({}) as ChalkViewSpec;
  } catch {
    // Malformed, not just unfinished. Show it raw, as a closed fence would.
    return { kind: 'markdown', content: `\`\`\`\n${body}\n\`\`\`` };
  }
}

// A stream can pause mid-opener ("```chalk-sp"); don't flash it as text.
function withoutPartialOpener(text: string): string {
  const at = text.lastIndexOf('```');
  if (at === -1 || (at > 0 && text[at - 1] !== '\n')) return text;
  return CHALK_SPEC_OPENER.startsWith(text.slice(at)) ? text.slice(0, at) : text;
}
