import { describe, it, expect } from 'vitest';
import { adaConfig } from './agentConfig';
import { SKILL_KINDS, SKILL_DOCS } from './skillDocs';
import { extractPlan } from './chunkParser';

// The inline prompt is what tool-less transports (the Claude artifact runtime) receive as the
// system prompt. It must carry everything the tools would otherwise have supplied on demand.
describe('adaConfig.inlinePrompt', () => {
  it('exists and shares the persona preamble with systemPrompt', () => {
    expect(typeof adaConfig.inlinePrompt).toBe('string');
    const firstLine = adaConfig.systemPrompt.split('\n')[0];
    expect(adaConfig.inlinePrompt!.startsWith(firstLine)).toBe(true);
  });

  it('never mentions the tools, which the transport cannot call', () => {
    expect(adaConfig.inlinePrompt).not.toContain('set_lesson_plan');
    expect(adaConfig.inlinePrompt).not.toContain('get_spec_docs');
  });

  it('asks for the lesson plan as a fenced chalk-plan block instead', () => {
    expect(adaConfig.inlinePrompt).toContain('```chalk-plan');
  });

  it('inlines the spec docs for every kind except chalk-draw', () => {
    for (const kind of SKILL_KINDS) {
      if (kind === 'chalk-draw') continue;
      expect(adaConfig.inlinePrompt).toContain(SKILL_DOCS[kind]);
    }
  });

  it('does not offer chalk-draw, since the artifact runtime cannot send images', () => {
    expect(adaConfig.inlinePrompt).not.toContain('chalk-draw');
  });

  it('leaves systemPrompt still describing the tool-based flow', () => {
    expect(adaConfig.systemPrompt).toContain('set_lesson_plan');
    expect(adaConfig.systemPrompt).toContain('get_spec_docs');
    expect(adaConfig.systemPrompt).not.toContain('chalk-plan');
  });
});

describe('extractPlan', () => {
  it('returns the content untouched with no plan when there is no chalk-plan fence', () => {
    expect(extractPlan('Just a reply.')).toEqual({ content: 'Just a reply.', plan: undefined });
  });

  it('pulls the fenced plan out of the content and returns the remaining text', () => {
    const input = 'Intro.\n\n```chalk-plan\n# Plan\n1. Limits\n2. Derivatives\n```\n\nLet us begin.';
    expect(extractPlan(input)).toEqual({
      content: 'Intro.\n\nLet us begin.',
      plan: '# Plan\n1. Limits\n2. Derivatives',
    });
  });

  it('extracts only the first fence and leaves any later ones in the content', () => {
    const input = '```chalk-plan\nA\n```\ntext\n```chalk-plan\nB\n```';
    const out = extractPlan(input);
    expect(out.plan).toBe('A');
    expect(out.content).toContain('```chalk-plan\nB\n```');
  });

  it('does not confuse a chalk-spec fence for a plan', () => {
    const input = '```chalk-spec\n{"kind":"text","content":"x"}\n```';
    expect(extractPlan(input)).toEqual({ content: input, plan: undefined });
  });

  it('ignores an empty plan fence but still removes it from the content', () => {
    expect(extractPlan('Hi\n```chalk-plan\n\n```\nthere')).toEqual({ content: 'Hi\nthere', plan: undefined });
  });
});
