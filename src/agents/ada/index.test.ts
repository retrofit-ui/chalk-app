import { describe, it, expect } from 'vitest';
import { adaConfig } from './agentConfig';
import { getSkillDocs, SKILL_KINDS } from './skillDocs';

describe('adaConfig.executeSkill', () => {
  it('calls getSkillDocs with the requested kinds for a valid get_spec_docs call', () => {
    const result = adaConfig.executeSkill!('get_spec_docs', { kinds: ['chalk-graph', 'chalk-sets'] });
    expect(result).toBe(getSkillDocs(['chalk-graph', 'chalk-sets']));
  });

  it('returns the concatenated docs string as the tool result for a valid call', () => {
    const result = adaConfig.executeSkill!('get_spec_docs', { kinds: ['chalk-matrix'] });
    expect(result).toContain('## chalk-matrix');
  });

  it('returns "Unknown tool: <name>" for any tool name other than get_spec_docs', () => {
    expect(adaConfig.executeSkill!('some_other_tool', {})).toBe('Unknown tool: some_other_tool');
  });

  it('does not itself handle set_lesson_plan — that tool is executed by chat.ts, not delegated here', () => {
    expect(adaConfig.executeSkill!('set_lesson_plan', { plan: 'x' })).toBe('Unknown tool: set_lesson_plan');
  });

  it('returns an "Invalid input" error string when input.kinds is missing', () => {
    expect(adaConfig.executeSkill!('get_spec_docs', {})).toBe('Invalid input: "kinds" must be an array of strings.');
  });

  it('returns an "Invalid input" error string when input.kinds is not an array', () => {
    expect(adaConfig.executeSkill!('get_spec_docs', { kinds: 'chalk-graph' })).toBe(
      'Invalid input: "kinds" must be an array of strings.',
    );
  });

  it('returns an "Invalid input" error string when input.kinds contains a non-string element', () => {
    expect(adaConfig.executeSkill!('get_spec_docs', { kinds: ['chalk-graph', 123] })).toBe(
      'Invalid input: "kinds" must be an array of strings.',
    );
  });
});

describe('ada agent shape', () => {
  it('declares exactly two skills: get_spec_docs and set_lesson_plan', () => {
    expect(adaConfig.skills.map((s) => s.name).sort()).toEqual(['get_spec_docs', 'set_lesson_plan']);
  });

  it('get_spec_docs input_schema.kinds enum matches SKILL_KINDS exactly', () => {
    const getSpecDocs = adaConfig.skills.find((s) => s.name === 'get_spec_docs')!;
    const schema = getSpecDocs.input_schema as {
      properties: { kinds: { items: { enum: string[] } } };
    };
    expect(schema.properties.kinds.items.enum).toEqual(SKILL_KINDS);
  });

  it('set_lesson_plan requires a string "plan" input', () => {
    const setLessonPlan = adaConfig.skills.find((s) => s.name === 'set_lesson_plan')!;
    const schema = setLessonPlan.input_schema as {
      properties: { plan: { type: string } };
      required: string[];
    };
    expect(schema.properties.plan.type).toBe('string');
    expect(schema.required).toContain('plan');
  });

  it('systemPrompt instructs the model to call set_lesson_plan rather than use >>PLAN<< markers', () => {
    expect(adaConfig.systemPrompt).toContain('set_lesson_plan');
    expect(adaConfig.systemPrompt).not.toContain('>>PLAN<<');
  });

  it('systemPrompt mentions every top-level kind name it instructs the model to use (chalk-graph, chalk-draw, chalk-sets, chalk-graph3d, chalk-vectors, chalk-matrix, layout)', () => {
    for (const kind of SKILL_KINDS) {
      if (kind === 'layout') {
        expect(adaConfig.systemPrompt).toContain('layout');
      } else {
        expect(adaConfig.systemPrompt).toContain(`\`${kind}\``);
      }
    }
  });
});
