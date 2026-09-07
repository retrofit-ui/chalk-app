import { describe, it, expect } from 'vitest';
import { getSkillDocs, SKILL_DOCS, SKILL_KINDS } from './skillDocs';

describe('getSkillDocs', () => {
  it('returns the doc string for a single known kind', () => {
    expect(getSkillDocs(['chalk-graph'])).toBe(SKILL_DOCS['chalk-graph']);
  });

  it('concatenates docs for multiple known kinds, in the order requested', () => {
    expect(getSkillDocs(['chalk-sets', 'chalk-graph'])).toBe(
      [SKILL_DOCS['chalk-sets'], SKILL_DOCS['chalk-graph']].join('\n\n'),
    );
  });

  it('deduplicates repeated kinds in the input, including each doc only once', () => {
    expect(getSkillDocs(['chalk-graph', 'chalk-graph'])).toBe(SKILL_DOCS['chalk-graph']);
  });

  it('appends an "Unknown kind(s)" notice listing every unrecognized kind', () => {
    const result = getSkillDocs(['bogus-kind']);
    expect(result).toContain('Unknown kind(s): bogus-kind.');
  });

  it('lists all valid SKILL_KINDS in the unknown-kind notice', () => {
    const result = getSkillDocs(['bogus-kind']);
    expect(result).toContain(`Valid kinds: ${SKILL_KINDS.join(', ')}.`);
  });

  it('mixes known-kind docs and the unknown-kind notice when input has both', () => {
    const result = getSkillDocs(['chalk-graph', 'bogus-kind']);
    expect(result).toContain(SKILL_DOCS['chalk-graph']);
    expect(result).toContain('Unknown kind(s): bogus-kind.');
  });

  it('returns a non-empty entry for every kind in SKILL_KINDS (chalk-graph, chalk-draw, chalk-sets, chalk-graph3d, chalk-vectors, chalk-matrix, layout)', () => {
    for (const kind of SKILL_KINDS) {
      expect(getSkillDocs([kind]).length).toBeGreaterThan(0);
    }
  });

  it('returns an empty string for an empty kinds array', () => {
    expect(getSkillDocs([])).toBe('');
  });
});
