import type { JSX } from 'solid-js';
import type { ChatMessage } from '../anthropic';

export type Skill = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type HarnessProps = {
  message: ChatMessage;
};

export type Agent = {
  id: string;
  name: string;
  version: string;
  description: string;
  systemPrompt: string;
  skills: Skill[];
  // The harness renders a single message into JSX.
  // It owns the rendering decision: which retrofit-ui spec to emit,
  // which component to route to, how tool results look.
  Harness: (props: HarnessProps) => JSX.Element;
};
