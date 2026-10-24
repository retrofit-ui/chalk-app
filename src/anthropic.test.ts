import { describe, it, expect } from 'vitest';
import { estimateCost, supportsEffort, thinkingConfig, visibleText } from './anthropic';

const M = 1_000_000;

describe('estimateCost', () => {
  it('prices Sonnet 5.5 at $2 / $10 with 0.1x cache reads and 1.25x cache writes', () => {
    const cost = estimateCost('claude-sonnet-5-5', {
      input_tokens: M, output_tokens: M, cache_creation_input_tokens: M, cache_read_input_tokens: M,
    });
    expect(cost).toBeCloseTo(2 + 10 + 2.5 + 0.2);
  });

  it('prices Opus 5.5 cache reads at 0.05x input', () => {
    expect(estimateCost('claude-opus-5-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: M })).toBeCloseTo(0.2);
  });

  it('switches Haiku 5.5 to its long-prompt rates above 100K prompt tokens, cache included', () => {
    expect(estimateCost('claude-haiku-5-5', { input_tokens: M / 10, output_tokens: M })).toBeCloseTo(0.01 + 0.5);
    const long = estimateCost('claude-haiku-5-5', { input_tokens: 1_000, output_tokens: M, cache_read_input_tokens: 100_000 });
    expect(long).toBeCloseTo((1_000 / M) * 0.5 + 2.5 + (100_000 / M) * 0.5 * 0.1);
  });

  it('still prices conversations saved on older models at their own rates', () => {
    expect(estimateCost('claude-sonnet-4-6', { input_tokens: M, output_tokens: 0 })).toBeCloseTo(3);
  });
});

describe('thinkingConfig', () => {
  it('asks Opus and Sonnet 5.5 for update notes under the beta', () => {
    expect(thinkingConfig('claude-opus-5-5', 'max')).toEqual({
      params: { thinking: { type: 'adaptive', display: 'updates' }, output_config: { effort: 'max' } },
      betas: ['thinking-display-updates-2026-08-18'],
    });
  });

  it('sends nothing for models outside the picker', () => {
    expect(supportsEffort('claude-opus-4-7')).toBe(false);
    expect(thinkingConfig('claude-opus-4-7', 'low')).toEqual({ params: {}, betas: [] });
  });
});

describe('visibleText', () => {
  it('joins text and non-empty thinking notes in order, skipping signatures-only blocks and tool calls', () => {
    expect(visibleText([
      { type: 'thinking', thinking: '', signature: 's0' },
      { type: 'thinking', thinking: 'Checking docs.', signature: 's1' },
      { type: 'redacted_thinking', data: 'x' },
      { type: 'text', text: 'Yes.' },
      { type: 'tool_use', id: 't', name: 'n', input: {} },
    ])).toBe('Checking docs.\n\nYes.');
  });

  it('returns string content as is', () => {
    expect(visibleText('plain')).toBe('plain');
  });
});
