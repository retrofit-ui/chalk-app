import { describe, it, expect } from 'vitest';
import { BERNOULLI_INLINE_PROMPT, BERNOULLI_SYSTEM_PROMPT } from './prompt';

describe('Bernoulli prompts', () => {
  it('systemPrompt still describes the set_lesson_plan tool and the drawing canvas', () => {
    expect(BERNOULLI_SYSTEM_PROMPT).toContain('call `set_lesson_plan` with a plan in this shape:\n\n# [Topic]');
    expect(BERNOULLI_SYSTEM_PROMPT).toContain('"kind": "chalk-draw"');
    expect(BERNOULLI_SYSTEM_PROMPT).toContain('Use interactive graphs and drawing canvases heavily');
    expect(BERNOULLI_SYSTEM_PROMPT).not.toContain('chalk-plan');
  });

  it('inlinePrompt shares the persona and phase structure', () => {
    expect(BERNOULLI_INLINE_PROMPT.split('\n')[0]).toBe(BERNOULLI_SYSTEM_PROMPT.split('\n')[0]);
    expect(BERNOULLI_INLINE_PROMPT).toContain('## Phase 2: Socratic teaching');
    expect(BERNOULLI_INLINE_PROMPT).toContain('**Graph rules:**');
  });

  it('inlinePrompt requests the plan as a well-formed chalk-plan fence with the same shape', () => {
    expect(BERNOULLI_INLINE_PROMPT).not.toContain('set_lesson_plan');
    expect(BERNOULLI_INLINE_PROMPT).toContain(
      '```chalk-plan\n# [Topic]\n## What the student knows\n- ...\n## What we\'re working toward\n1. ...\n2. ...\n```\n',
    );
  });

  it('inlinePrompt drops every mention of drawing, since the artifact runtime cannot send images', () => {
    expect(BERNOULLI_INLINE_PROMPT).not.toContain('chalk-draw');
    expect(BERNOULLI_INLINE_PROMPT).not.toContain('Drawing canvas');
    expect(BERNOULLI_INLINE_PROMPT).not.toContain('drawing canvases');
    expect(BERNOULLI_INLINE_PROMPT).toContain('Use interactive graphs heavily');
  });
});
