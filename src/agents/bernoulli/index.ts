import type { Agent } from '../types';
import Harness from '../ada/harness';
import { BERNOULLI_INLINE_PROMPT, BERNOULLI_SYSTEM_PROMPT } from './prompt';

const bernoulli: Agent = {
  id: 'bernoulli',
  name: 'Bernoulli',
  version: '1.0.0',
  description: 'A Socratic mathematics tutor named after Jacob Bernoulli. Discovers first, then teaches through diagrams and questions.',

  systemPrompt: BERNOULLI_SYSTEM_PROMPT,
  inlinePrompt: BERNOULLI_INLINE_PROMPT,

  skills: [
    {
      name: 'set_lesson_plan',
      description:
        'Set or update the lesson plan for this conversation. Call this when transitioning from Phase 1 to Phase 2, and again whenever the plan needs to change.',
      input_schema: {
        type: 'object',
        properties: {
          plan: { type: 'string', description: 'The full lesson plan, in markdown.' },
        },
        required: ['plan'],
      },
    },
  ],

  Harness,
};

export default bernoulli;
