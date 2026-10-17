import { describe, it, expect } from 'vitest';
import { SKILL_DOCS } from '../skillDocs';
import type { ChalkAutomatonSpec, ChalkMarkovSpec, ChalkMdpSpec, ChalkSearchSpec } from '../spec';
import { validateAutomaton, runAutomaton, tokenize } from './automaton';
import { validateSearch, runSearch, checkHeuristic } from './search';
import { validateMarkov, transitionMatrix, absorptionAnalysis } from './markov';
import { validateMdp, valueIteration } from './mdp';

// The worked examples in the skill docs are what the model copies. Each one must be a valid
// spec, and the claims the prose makes about it must be what the engines actually compute.

const examples = (kind: keyof typeof SKILL_DOCS) =>
  [...SKILL_DOCS[kind].matchAll(/```chalk-spec\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));

describe('state-machine skill docs', () => {
  it('chalk-automaton examples are valid, and the even-1s machine behaves as described', () => {
    const specs = examples('chalk-automaton') as ChalkAutomatonSpec[];
    expect(specs.length).toBeGreaterThanOrEqual(3);
    for (const s of specs) {
      expect(s.kind).toBe('chalk-automaton');
      expect(validateAutomaton(s)).toEqual([]);
    }
    const [even, nfa, turnstile] = specs;
    expect(runAutomaton(even, tokenize(even, '1011')).at(-1)!.status).toBe('rejected');
    expect(runAutomaton(nfa, tokenize(nfa, 'aab')).at(-1)!.status).toBe('accepted');
    expect(runAutomaton(turnstile, tokenize(turnstile, 'coin push')).at(-1)!.status).toBe('accepted');
  });

  it('chalk-search examples are valid with sound heuristics, and the reconciliation claim holds', () => {
    const specs = examples('chalk-search') as ChalkSearchSpec[];
    expect(specs.length).toBeGreaterThanOrEqual(2);
    for (const s of specs) {
      expect(s.kind).toBe('chalk-search');
      expect(validateSearch(s)).toEqual([]);
      expect(checkHeuristic(s)).toEqual({ overestimates: [], inconsistent: [] });
    }
    const recon = specs[1];
    const bfs = runSearch(recon, 'bfs').at(-1)!;
    const dij = runSearch(recon, 'dijkstra').at(-1)!;
    const astar = runSearch(recon, 'astar').at(-1)!;
    expect(bfs.pathCost).toBe(8);
    expect(dij.pathCost).toBe(5);
    expect(astar.pathCost).toBe(5);
    expect(astar.closed.length).toBeLessThan(dij.closed.length);
  });

  it('chalk-markov examples are valid; gambler’s ruin has the absorbing states the prose implies', () => {
    const specs = examples('chalk-markov') as ChalkMarkovSpec[];
    for (const s of specs) {
      expect(s.kind).toBe('chalk-markov');
      expect(validateMarkov(s)).toEqual([]);
    }
    expect(absorptionAnalysis(transitionMatrix(specs[1])).absorbing).toEqual([0, 3]);
  });

  it('chalk-mdp examples are valid; the first flips from cash out to collect as gamma grows', () => {
    const specs = examples('chalk-mdp') as ChalkMdpSpec[];
    for (const s of specs) {
      expect(s.kind).toBe('chalk-mdp');
      expect(validateMdp(s)).toEqual([]);
    }
    const [cash] = specs;
    const policyAt = (g: number) => cash.actions[valueIteration(cash, g).at(-1)!.policy.here!].name;
    expect(policyAt(0.2)).toBe('cash out');
    expect(policyAt(0.9)).toBe('collect');
  });
});
