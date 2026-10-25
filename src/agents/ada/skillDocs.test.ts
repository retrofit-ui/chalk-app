import { describe, it, expect } from 'vitest';
import { COORDINATES_DOC, getSkillDocs, SKILL_DOCS, SKILL_KINDS } from './skillDocs';
import { resolveDraw, resolveGraph, resolveScene, resolveVectors } from './resolveSpecs';

describe('getSkillDocs', () => {
  it('returns the doc string for a single known kind', () => {
    expect(getSkillDocs(['chalk-sets'])).toBe(SKILL_DOCS['chalk-sets']);
  });

  it('concatenates docs for multiple known kinds, in the order requested', () => {
    expect(getSkillDocs(['chalk-sets', 'chalk-matrix'])).toBe(
      [SKILL_DOCS['chalk-sets'], SKILL_DOCS['chalk-matrix']].join('\n\n'),
    );
  });

  it('deduplicates repeated kinds in the input, including each doc only once', () => {
    expect(getSkillDocs(['chalk-sets', 'chalk-sets'])).toBe(SKILL_DOCS['chalk-sets']);
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

describe('the shared Coordinates section', () => {
  it('follows the docs of any plotting kind, once per request', () => {
    const docs = getSkillDocs(['chalk-graph', 'chalk-vectors', 'chalk-graph3d']);
    expect(docs).toBe([SKILL_DOCS['chalk-graph'], SKILL_DOCS['chalk-vectors'], SKILL_DOCS['chalk-graph3d'], COORDINATES_DOC].join('\n\n'));
    expect(docs.split('## Coordinates')).toHaveLength(2);
  });

  it('is left out for kinds without coordinates', () => {
    expect(getSkillDocs(['chalk-sets', 'layout'])).not.toContain('## Coordinates');
  });
});

describe('every chalk-spec example in the docs', () => {
  const RESOLVERS: Record<string, (spec: never) => unknown> = {
    'chalk-graph': resolveGraph,
    'chalk-vectors': resolveVectors,
    'chalk-draw': resolveDraw,
    'chalk-graph3d': resolveScene,
  };
  const examples = [...Object.values(SKILL_DOCS), COORDINATES_DOC].flatMap((doc) =>
    [...doc.matchAll(/```chalk-spec\n([\s\S]*?)\n```/g)].map((m) => m[1]),
  );
  const nodes = (spec: unknown): Array<{ kind: string }> => {
    const node = spec as { kind?: string; children?: unknown[] };
    return [...(typeof node.kind === 'string' ? [node as { kind: string }] : []), ...(node.children ?? []).flatMap(nodes)];
  };

  it('is valid JSON', () => {
    expect(examples.length).toBeGreaterThan(20);
    for (const json of examples) expect(() => JSON.parse(json), json).not.toThrow();
  });

  it('passes the coordinate validators', () => {
    const plotted = examples.flatMap((json) => nodes(JSON.parse(json))).filter((n) => n.kind in RESOLVERS);
    expect(plotted.length).toBeGreaterThan(10);
    for (const node of plotted) expect(() => RESOLVERS[node.kind](node as never), JSON.stringify(node)).not.toThrow();
  });
});
