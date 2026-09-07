import { describe, it, expect } from 'vitest';
import { findPreviousAnswers, parseChunks } from './chunkParser';
import type { ChatMessage } from '../../anthropic';

function fence(spec: unknown): string {
  return `\`\`\`chalk-spec\n${JSON.stringify(spec)}\n\`\`\``;
}

function msg(overrides: Partial<ChatMessage>): ChatMessage {
  return { id: 'm', role: 'user', content: '', ...overrides };
}

describe('parseChunks', () => {
  describe('plain markdown (no chalk-spec fences)', () => {
    it('returns a single markdown chunk when content has no chalk-spec fences', () => {
      expect(parseChunks('Hello **world**')).toEqual([{ kind: 'markdown', content: 'Hello **world**' }]);
    });

    it('returns an empty array for empty string content', () => {
      expect(parseChunks('')).toEqual([]);
    });

    it('preserves markdown formatting (lists, bold, headings, LaTeX) verbatim in the chunk', () => {
      const md = '# Heading\n\n- item 1\n- item 2\n\n$x^2$ and **bold**';
      expect(parseChunks(md)).toEqual([{ kind: 'markdown', content: md }]);
    });
  });

  describe('single chalk-spec block per kind', () => {
    it('parses a chalk-graph block (curves only) into a ChalkGraphSpec chunk', () => {
      const spec = { kind: 'chalk-graph', graphType: 'cartesian', curves: [{ fn: 'sin(x)' }] };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a chalk-graph block with labelled points into a ChalkGraphSpec chunk', () => {
      const spec = {
        kind: 'chalk-graph',
        graphType: 'cartesian',
        curves: [{ fn: 'x^2 - 1' }],
        points: [{ x: 1, y: 0, label: '(1, 0)' }],
      };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a chalk-graph block with interactive:true', () => {
      const spec = {
        kind: 'chalk-graph',
        graphType: 'cartesian',
        curves: [{ fn: 'x' }],
        interactive: true,
      };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a chalk-graph block with params (slider) into a ChalkGraphSpec chunk with params', () => {
      const spec = {
        kind: 'chalk-graph',
        graphType: 'cartesian',
        curves: [{ fn: 'x^2 + lambda' }],
        params: [{ name: 'lambda', min: 0, max: 10, default: 0 }],
      };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a chalk-draw block into a ChalkDrawSpec chunk', () => {
      const spec = { kind: 'chalk-draw', xDomain: [-5, 5], yDomain: [-5, 5], prompt: 'Draw it' };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a chalk-sets block (sets/partitions/annotations) into a ChalkSetsSpec chunk', () => {
      const spec = {
        kind: 'chalk-sets',
        universe: 'Ω',
        sets: [{ id: 'A', label: 'A', cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.2 }],
        partitions: [{ id: 'p', x: 0.5 }],
        annotations: [{ x: 0.5, y: 0.5, text: 'label' }],
      };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a chalk-graph3d block (planes/points/vectors) into a ChalkGraph3DSpec chunk', () => {
      const spec = {
        kind: 'chalk-graph3d',
        planes: [{ point: [0, 0, 0], basis1: [1, 0, 0], basis2: [0, 1, 0] }],
        points: [{ id: 'y', position: [1, 1, 1], label: 'y', draggable: true }],
      };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a chalk-vectors block into a ChalkVectorsSpec chunk', () => {
      const spec = {
        kind: 'chalk-vectors',
        compose: 'head-to-tail',
        vectors: [{ id: 'yhat', x: 3, y: 1, label: 'ŷ' }],
      };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a chalk-matrix block into a ChalkMatrixSpec chunk', () => {
      const spec = { kind: 'chalk-matrix', values: [[1, 2], [3, 4]], highlightDiagonal: true };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses an answerbox block into a ChalkAnswerBoxSpec chunk', () => {
      const spec = { kind: 'answerbox', identifier: 'q1', label: 'Answer' };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a flex layout block with nested leaf children', () => {
      const spec = {
        kind: 'flex',
        direction: 'row',
        children: [{ kind: 'text', content: 'a' }, { kind: 'text', content: 'b' }],
      };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a grid layout block with nested leaf children', () => {
      const spec = {
        kind: 'grid',
        columns: 2,
        children: [{ kind: 'text', content: 'a' }, { kind: 'answerbox', identifier: 'q1' }],
      };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a card layout block with nested leaf children', () => {
      const spec = {
        kind: 'card',
        header: 'Key results',
        children: [{ kind: 'text', content: '$$x^2$$' }],
      };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a stat block with multiple stat entries', () => {
      const spec = {
        kind: 'stat',
        stats: [{ label: 'A', value: 1 }, { label: 'B', value: 2, description: 'desc' }],
      };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });

    it('parses a text block with an explicit variant', () => {
      const spec = { kind: 'text', content: 'hello', variant: 'muted' };
      expect(parseChunks(fence(spec))).toEqual([spec]);
    });
  });

  describe('markdown + chalk-spec interleaving', () => {
    it('emits a markdown chunk for text before a chalk-spec block, then the spec chunk', () => {
      const spec = { kind: 'chalk-graph', graphType: 'cartesian', curves: [{ fn: 'x' }] };
      const before = 'Some intro text\n\n';
      const chunks = parseChunks(before + fence(spec));
      expect(chunks).toEqual([{ kind: 'markdown', content: before }, spec]);
    });

    it('emits a markdown chunk for text after a chalk-spec block', () => {
      const spec = { kind: 'chalk-graph', graphType: 'cartesian', curves: [{ fn: 'x' }] };
      const after = '\n\nMore text after.';
      const chunks = parseChunks(fence(spec) + after);
      expect(chunks).toEqual([spec, { kind: 'markdown', content: after }]);
    });

    it('emits markdown, spec, markdown, spec in order for two specs in one message', () => {
      const spec1 = { kind: 'chalk-graph', graphType: 'cartesian', curves: [{ fn: 'x' }] };
      const spec2 = { kind: 'chalk-graph', graphType: 'cartesian', curves: [{ fn: 'x^2' }] };
      const before1 = 'First:\n\n';
      const between = '\n\nSecond:\n\n';
      const after2 = '\n\nDone.';
      const content = before1 + fence(spec1) + between + fence(spec2) + after2;
      const chunks = parseChunks(content);
      expect(chunks).toEqual([
        { kind: 'markdown', content: before1 },
        spec1,
        { kind: 'markdown', content: between },
        spec2,
        { kind: 'markdown', content: after2 },
      ]);
    });

    it('does not emit an empty markdown chunk for whitespace-only text between/around fences', () => {
      const spec = { kind: 'chalk-graph', graphType: 'cartesian', curves: [{ fn: 'x' }] };
      const content = '   \n' + fence(spec) + '  \n  ';
      expect(parseChunks(content)).toEqual([spec]);
    });
  });

  describe('malformed or truncated input', () => {
    it('falls back to a raw-JSON markdown chunk when a chalk-spec block contains invalid JSON', () => {
      const content = '```chalk-spec\n{not valid json\n```';
      expect(parseChunks(content)).toEqual([
        { kind: 'markdown', content: '```\n{not valid json\n```' },
      ]);
    });

    it('emits a truncation-warning markdown chunk for an unclosed chalk-spec fence at the end of content', () => {
      const content = 'Some text\n```chalk-spec\n{"kind":"chalk-graph"';
      const chunks = parseChunks(content);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ kind: 'markdown', content: 'Some text\n' });
      expect((chunks[1] as { content: string }).content).toContain('Truncated `chalk-spec` block');
    });

    it('includes the partial JSON body verbatim in the truncation-warning chunk', () => {
      const content = 'Some text\n```chalk-spec\n{"kind":"chalk-graph"';
      const chunks = parseChunks(content);
      expect((chunks[1] as { content: string }).content).toContain('{"kind":"chalk-graph"');
    });

    it('emits markdown for any text preceding an unclosed fence, before the truncation warning', () => {
      const content = 'Preamble here.\n```chalk-spec\n{"kind":"chalk-graph"';
      const chunks = parseChunks(content);
      expect(chunks[0]).toEqual({ kind: 'markdown', content: 'Preamble here.\n' });
      expect((chunks[1] as { content: string }).content).toContain('Truncated `chalk-spec` block');
    });
  });
});

describe('findPreviousAnswers', () => {
  it('returns undefined when no prior answer-submit message exists', () => {
    const messages = [msg({ role: 'user', content: 'hi' }), msg({ role: 'assistant', content: 'hello' })];
    expect(findPreviousAnswers(messages, 2)).toBeUndefined();
  });

  it('returns the answers map from the most recent prior answer-submit message', () => {
    const messages = [
      msg({ kind: 'answer-submit', answerData: { answers: { q1: 'old' } } }),
      msg({ kind: 'answer-submit', answerData: { answers: { q1: 'new' } } }),
      msg({ role: 'assistant', content: 'ok' }),
    ];
    expect(findPreviousAnswers(messages, 3)).toEqual({ q1: 'new' });
  });

  it('ignores answer-submit messages at or after the given index', () => {
    const messages = [
      msg({ kind: 'answer-submit', answerData: { answers: { q1: 'before' } } }),
      msg({ role: 'assistant', content: 'ok' }),
      msg({ kind: 'answer-submit', answerData: { answers: { q1: 'after' } } }),
    ];
    expect(findPreviousAnswers(messages, 1)).toEqual({ q1: 'before' });
  });

  it('skips over non-answer-submit messages while scanning backwards', () => {
    const messages = [
      msg({ kind: 'answer-submit', answerData: { answers: { q1: 'x' } } }),
      msg({ role: 'user', content: 'unrelated' }),
      msg({ role: 'assistant', content: 'unrelated reply' }),
      msg({ role: 'assistant', content: 'latest' }),
    ];
    expect(findPreviousAnswers(messages, 3)).toEqual({ q1: 'x' });
  });
});
