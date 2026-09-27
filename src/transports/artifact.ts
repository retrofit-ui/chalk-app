import type { Transport, TurnRequest, TurnEvent } from '../transport';
import { extractPlan } from '../agents/ada/chunkParser';

const MISSING_RUNTIME =
  'This build only runs inside a Claude artifact (window.claude.complete is missing).';

const FRAMING = `

---

You are continuing the conversation below. The transcript alternates between the student ("User") and you ("Assistant"). Reply with your next message only — no section header, no transcript, no commentary about the format.

`;

function renderContent(content: TurnRequest['messages'][number]['content']): string {
  if (typeof content === 'string') return content;
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') parts.push(block.text);
    else if (block.type === 'image') parts.push('[drawing omitted]');
    // tool_use / tool_result only appear in conversations created by the SDK build;
    // the model has no tools here, so replaying them would only confuse it.
  }
  return parts.join('\n');
}

/**
 * The artifact runtime takes a single prompt string, so the system prompt and the whole
 * history are serialized into one document ending on an open "### Assistant" cue.
 */
export function buildArtifactPrompt(req: TurnRequest): string {
  const sections: string[] = [];
  for (const m of req.messages) {
    const body = renderContent(m.content);
    if (!body.trim()) continue;
    sections.push(`### ${m.role === 'user' ? 'User' : 'Assistant'}\n${body}`);
  }
  return `${req.system}${FRAMING}${sections.join('\n\n')}\n\n### Assistant\n`;
}

/** Reaches the model through window.claude.complete — the viewer's own claude.ai account. */
export function artifactTransport(): Transport {
  return {
    supportsImages: false,
    supportsTools: false,
    async *run(req: TurnRequest): AsyncIterable<TurnEvent> {
      const complete = typeof window !== 'undefined' ? window.claude?.complete : undefined;
      if (typeof complete !== 'function') throw new Error(MISSING_RUNTIME);

      const raw = await complete(buildArtifactPrompt(req));
      const { content, plan } = extractPlan(raw);

      yield { type: 'text_delta', text: content };
      yield {
        type: 'done',
        message: { content: [{ type: 'text', text: content }], stop_reason: 'end_turn' },
        plan,
      };
    },
  };
}
