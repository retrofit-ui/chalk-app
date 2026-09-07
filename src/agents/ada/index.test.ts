import { describe, it } from 'vitest';

// Scaffolding only — behavior specs, no assertions yet. See the `ada` Agent definition
// (systemPrompt, skills, executeSkill) in ./index.ts. Filled in after this scaffold is
// reviewed for coverage.

describe('ada.executeSkill', () => {
  it.todo('calls getSkillDocs with the requested kinds for a valid get_spec_docs call');
  it.todo('returns the concatenated docs string as the tool result for a valid call');
  it.todo('returns "Unknown tool: <name>" for any tool name other than get_spec_docs');
  it.todo('returns an "Invalid input" error string when input.kinds is missing');
  it.todo('returns an "Invalid input" error string when input.kinds is not an array');
  it.todo('returns an "Invalid input" error string when input.kinds contains a non-string element');
});

describe('ada agent shape', () => {
  it.todo('declares exactly one skill named get_spec_docs');
  it.todo('get_spec_docs input_schema.kinds enum matches SKILL_KINDS exactly');
  it.todo('systemPrompt mentions every top-level kind name it instructs the model to use (chalk-graph, chalk-draw, chalk-sets, chalk-graph3d, chalk-vectors, chalk-matrix, layout)');
});
