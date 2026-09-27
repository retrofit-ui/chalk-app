import type { ChatMessage, TextBlock, ToolUseBlock } from './anthropic';
import type { Skill } from './agents/types';

/**
 * One assistant round, independent of how the model is reached. chat.ts owns the
 * conversation state and the tool loop; a Transport only knows how to turn a request
 * into a stream of text deltas and a final message.
 *
 * The event shape deliberately mirrors the SDK stream (text_delta events, then the
 * final message) so the SDK transport is a thin wrapper and chat.ts's loop is unchanged.
 */
export type TurnRequest = {
  model: string;
  system: string;
  tools?: Skill[];
  messages: ChatMessage[];
};

/**
 * Subset of the SDK's Message that chat.ts reads. Non-SDK transports fill only what they can.
 * The SDK may also emit other block types (thinking, server tool use…); chat.ts already
 * discriminates on `type` and drops anything it does not recognise.
 */
export type FinalMessage = {
  content: Array<TextBlock | ToolUseBlock>;
  stop_reason: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  };
  id?: string;
  model?: string;
  role?: string;
  type?: string;
  stop_sequence?: string | null;
};

export type TurnEvent =
  | { type: 'text_delta'; text: string }
  /** `plan` is set by transports that cannot call tools and extract the lesson plan from the reply instead. */
  | { type: 'done'; message: FinalMessage; plan?: string };

export interface Transport {
  run(req: TurnRequest): AsyncIterable<TurnEvent>;
  /** Whether image content blocks (drawing submissions) can be sent through this transport. */
  supportsImages: boolean;
}
