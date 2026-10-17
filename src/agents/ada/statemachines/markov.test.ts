import { describe, it, expect } from 'vitest';
import type { ChalkMarkovSpec } from '../spec';
import {
  transitionMatrix,
  rowSumErrors,
  distributionAt,
  longRunDistribution,
  absorptionAnalysis,
  sampleWalk,
  setProbability,
  validateMarkov,
} from './markov';

// Setosa's "sticky weather": sunny days tend to follow sunny days.
const weather: ChalkMarkovSpec = {
  kind: 'chalk-markov',
  states: [{ id: 'sunny' }, { id: 'rainy' }],
  transitions: [
    { from: 'sunny', to: 'sunny', p: 0.9 },
    { from: 'sunny', to: 'rainy', p: 0.1 },
    { from: 'rainy', to: 'sunny', p: 0.5 },
    { from: 'rainy', to: 'rainy', p: 0.5 },
  ],
};

// Gambler's ruin with $0..$3 and a fair coin; $0 and $3 are absorbing.
const ruin: ChalkMarkovSpec = {
  kind: 'chalk-markov',
  states: [{ id: '0' }, { id: '1' }, { id: '2' }, { id: '3' }],
  transitions: [
    { from: '0', to: '0', p: 1 },
    { from: '1', to: '0', p: 0.5 },
    { from: '1', to: '2', p: 0.5 },
    { from: '2', to: '1', p: 0.5 },
    { from: '2', to: '3', p: 0.5 },
    { from: '3', to: '3', p: 1 },
  ],
};

describe('transitionMatrix', () => {
  it('builds rows in state order, from-state by row and to-state by column', () => {
    expect(transitionMatrix(weather)).toEqual([
      [0.9, 0.1],
      [0.5, 0.5],
    ]);
  });

  it('sums duplicate transitions between the same pair', () => {
    const dup = { ...weather, transitions: [...weather.transitions.slice(1), { from: 'sunny', to: 'sunny', p: 0.4 }, { from: 'sunny', to: 'sunny', p: 0.5 }] };
    expect(transitionMatrix(dup)[0][0]).toBeCloseTo(0.9);
  });
});

describe('rowSumErrors', () => {
  it('is empty when every row sums to 1', () => {
    expect(rowSumErrors(weather)).toEqual([]);
  });

  it('names each state whose outgoing probabilities do not sum to 1', () => {
    const leaky = { ...weather, transitions: weather.transitions.filter((t) => !(t.from === 'rainy' && t.to === 'rainy')) };
    expect(rowSumErrors(leaky)).toEqual([{ id: 'rainy', sum: 0.5 }]);
  });
});

describe('distributionAt', () => {
  const P = transitionMatrix(weather);
  it('is the starting distribution at step 0', () => {
    expect(distributionAt(P, [1, 0], 0)).toEqual([1, 0]);
  });

  it('multiplies by P once per step', () => {
    const d1 = distributionAt(P, [1, 0], 1);
    expect(d1[0]).toBeCloseTo(0.9);
    expect(d1[1]).toBeCloseTo(0.1);
    const d2 = distributionAt(P, [1, 0], 2);
    expect(d2[0]).toBeCloseTo(0.86);
    expect(d2[1]).toBeCloseTo(0.14);
  });
});

describe('longRunDistribution', () => {
  it('finds the stationary distribution of an ergodic chain (5/6 sunny)', () => {
    const pi = longRunDistribution(transitionMatrix(weather), [0, 1]);
    expect(pi[0]).toBeCloseTo(5 / 6, 4);
    expect(pi[1]).toBeCloseTo(1 / 6, 4);
  });

  it('gives the long-run fraction of time for a periodic chain instead of oscillating', () => {
    const P = [
      [0, 1],
      [1, 0],
    ];
    const pi = longRunDistribution(P, [1, 0]);
    expect(pi[0]).toBeCloseTo(0.5, 3);
    expect(pi[1]).toBeCloseTo(0.5, 3);
  });

  it('depends on the start when there are several absorbing states', () => {
    const pi = longRunDistribution(transitionMatrix(ruin), [0, 1, 0, 0]);
    expect(pi[0]).toBeCloseTo(2 / 3, 2);
    expect(pi[3]).toBeCloseTo(1 / 3, 2);
  });
});

describe('absorptionAnalysis', () => {
  it('identifies absorbing states', () => {
    expect(absorptionAnalysis(transitionMatrix(ruin)).absorbing).toEqual([0, 3]);
  });

  it('computes the expected number of steps until absorption (k(N-k) for a fair game)', () => {
    const { expectedSteps } = absorptionAnalysis(transitionMatrix(ruin));
    expect(expectedSteps[0]).toBe(0);
    expect(expectedSteps[1]).toBeCloseTo(2);
    expect(expectedSteps[2]).toBeCloseTo(2);
    expect(expectedSteps[3]).toBe(0);
  });

  it('computes the probability of ending in each absorbing state', () => {
    const { absorptionProbabilities } = absorptionAnalysis(transitionMatrix(ruin));
    // from $1: ruin with 2/3, reach $3 with 1/3
    expect(absorptionProbabilities[1][0]).toBeCloseTo(2 / 3);
    expect(absorptionProbabilities[1][3]).toBeCloseTo(1 / 3);
  });

  it('reports Infinity for states that can never be absorbed', () => {
    const P = [
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ];
    const { expectedSteps } = absorptionAnalysis(P);
    expect(expectedSteps[1]).toBe(Infinity);
    expect(expectedSteps[2]).toBe(Infinity);
  });

  it('has no absorbing states for the weather chain', () => {
    expect(absorptionAnalysis(transitionMatrix(weather)).absorbing).toEqual([]);
  });
});

describe('sampleWalk', () => {
  const P = transitionMatrix(ruin);
  it('is reproducible for a given seed and includes the start', () => {
    const a = sampleWalk(P, 1, 20, 42);
    expect(a).toEqual(sampleWalk(P, 1, 20, 42));
    expect(a[0]).toBe(1);
    expect(a).toHaveLength(21);
  });

  it('only ever takes transitions with positive probability', () => {
    const walk = sampleWalk(P, 1, 200, 7);
    for (let i = 1; i < walk.length; i++) expect(P[walk[i - 1]][walk[i]]).toBeGreaterThan(0);
  });

  it('visits states in roughly the long-run proportions', () => {
    const walk = sampleWalk(transitionMatrix(weather), 0, 20000, 1);
    const sunny = walk.filter((s) => s === 0).length / walk.length;
    expect(sunny).toBeGreaterThan(0.8);
    expect(sunny).toBeLessThan(0.87);
  });
});

describe('setProbability', () => {
  it('rescales the other outgoing edges so the row still sums to 1', () => {
    const next = setProbability(weather, 'sunny', 'rainy', 0.3);
    const P = transitionMatrix({ ...weather, transitions: next });
    expect(P[0][1]).toBeCloseTo(0.3);
    expect(P[0][0]).toBeCloseTo(0.7);
    expect(P[1]).toEqual([0.5, 0.5]);
  });

  it('keeps the ratio between the other edges', () => {
    const three: ChalkMarkovSpec = {
      kind: 'chalk-markov',
      states: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      transitions: [
        { from: 'a', to: 'a', p: 0.5 },
        { from: 'a', to: 'b', p: 0.3 },
        { from: 'a', to: 'c', p: 0.2 },
      ],
    };
    const next = setProbability(three, 'a', 'b', 0.6);
    const byTo = Object.fromEntries(next.filter((t) => t.from === 'a').map((t) => [t.to, t.p]));
    expect(byTo.b).toBeCloseTo(0.6);
    expect(byTo.a).toBeCloseTo(0.4 * (5 / 7));
    expect(byTo.c).toBeCloseTo(0.4 * (2 / 7));
  });

  it('shares the remainder equally when the other edges were all zero', () => {
    const zeros: ChalkMarkovSpec = {
      kind: 'chalk-markov',
      states: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      transitions: [
        { from: 'a', to: 'b', p: 1 },
        { from: 'a', to: 'c', p: 0 },
        { from: 'a', to: 'a', p: 0 },
      ],
    };
    const next = setProbability(zeros, 'a', 'b', 0.4);
    const byTo = Object.fromEntries(next.map((t) => [t.to, t.p]));
    expect(byTo.c).toBeCloseTo(0.3);
    expect(byTo.a).toBeCloseTo(0.3);
  });

  it('clamps to [0, 1] and pins the edge to 1 when it is the only one out of its state', () => {
    const next = setProbability(ruin, '0', '0', 0.2);
    expect(next.find((t) => t.from === '0')!.p).toBe(1);
    const clamped = setProbability(weather, 'sunny', 'rainy', 7);
    expect(clamped.find((t) => t.from === 'sunny' && t.to === 'rainy')!.p).toBe(1);
  });
});

describe('validateMarkov', () => {
  it('accepts a valid chain', () => {
    expect(validateMarkov(weather)).toEqual([]);
  });

  it('reports unknown states, negative probabilities and bad row sums', () => {
    const errors = validateMarkov({
      ...weather,
      transitions: [
        { from: 'sunny', to: 'cloudy', p: 0.5 },
        { from: 'sunny', to: 'sunny', p: -0.5 },
      ],
    }).join(' ');
    expect(errors).toContain('cloudy');
    expect(errors).toContain('negative');
    expect(errors).toContain('sum');
  });
});
