import { describe, it } from 'vitest';

// Scaffolding only — behavior specs, no assertions yet. See parseChunks/findPreviousAnswers
// in ./harness.tsx. Filled in after this scaffold is reviewed for coverage.

describe('parseChunks', () => {
  describe('plain markdown (no chalk-spec fences)', () => {
    it.todo('returns a single markdown chunk when content has no chalk-spec fences');
    it.todo('returns an empty array for empty string content');
    it.todo('preserves markdown formatting (lists, bold, headings, LaTeX) verbatim in the chunk');
  });

  describe('single chalk-spec block per kind', () => {
    it.todo('parses a chalk-graph block (curves only) into a ChalkGraphSpec chunk');
    it.todo('parses a chalk-graph block with labelled points into a ChalkGraphSpec chunk');
    it.todo('parses a chalk-graph block with interactive:true');
    it.todo('parses a chalk-graph block with params (slider) into a ChalkGraphSpec chunk with params');
    it.todo('parses a chalk-draw block into a ChalkDrawSpec chunk');
    it.todo('parses a chalk-sets block (sets/partitions/annotations) into a ChalkSetsSpec chunk');
    it.todo('parses a chalk-graph3d block (planes/points/vectors) into a ChalkGraph3DSpec chunk');
    it.todo('parses a chalk-vectors block into a ChalkVectorsSpec chunk');
    it.todo('parses a chalk-matrix block into a ChalkMatrixSpec chunk');
    it.todo('parses an answerbox block into a ChalkAnswerBoxSpec chunk');
    it.todo('parses a flex layout block with nested leaf children');
    it.todo('parses a grid layout block with nested leaf children');
    it.todo('parses a card layout block with nested leaf children');
    it.todo('parses a stat block with multiple stat entries');
    it.todo('parses a text block with an explicit variant');
  });

  describe('markdown + chalk-spec interleaving', () => {
    it.todo('emits a markdown chunk for text before a chalk-spec block, then the spec chunk');
    it.todo('emits a markdown chunk for text after a chalk-spec block');
    it.todo('emits markdown, spec, markdown, spec in order for two specs in one message');
    it.todo('does not emit an empty markdown chunk for whitespace-only text between/around fences');
  });

  describe('malformed or truncated input', () => {
    it.todo('falls back to a raw-JSON markdown chunk when a chalk-spec block contains invalid JSON');
    it.todo('emits a truncation-warning markdown chunk for an unclosed chalk-spec fence at the end of content');
    it.todo('includes the partial JSON body verbatim in the truncation-warning chunk');
    it.todo('emits markdown for any text preceding an unclosed fence, before the truncation warning');
  });
});

describe('findPreviousAnswers', () => {
  it.todo('returns undefined when no prior answer-submit message exists');
  it.todo('returns the answers map from the most recent prior answer-submit message');
  it.todo('ignores answer-submit messages at or after the given index');
  it.todo('skips over non-answer-submit messages while scanning backwards');
});
