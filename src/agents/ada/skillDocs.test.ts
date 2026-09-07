import { describe, it } from 'vitest';

// Scaffolding only — behavior specs, no assertions yet. See getSkillDocs in ./skillDocs.ts.
// Filled in after this scaffold is reviewed for coverage.

describe('getSkillDocs', () => {
  it.todo('returns the doc string for a single known kind');
  it.todo('concatenates docs for multiple known kinds, in the order requested');
  it.todo('deduplicates repeated kinds in the input, including each doc only once');
  it.todo('appends an "Unknown kind(s)" notice listing every unrecognized kind');
  it.todo('lists all valid SKILL_KINDS in the unknown-kind notice');
  it.todo('mixes known-kind docs and the unknown-kind notice when input has both');
  it.todo('returns a non-empty entry for every kind in SKILL_KINDS (chalk-graph, chalk-draw, chalk-sets, chalk-graph3d, chalk-vectors, chalk-matrix, layout)');
  it.todo('returns an empty string for an empty kinds array');
});
