import { describe, it, expect } from 'vitest';
import type { ChalkMdpSpec } from '../spec';
import { valueIteration, bellmanBackup, validateMdp } from './mdp';

// "Cash out now or keep collecting": `go` pays 1 once and ends; `stay` pays 0.5 forever.
// With gamma 0.9 staying is worth 0.5 / (1 - 0.9) = 5, so the optimal policy flips to stay
// only after enough sweeps for the future to be counted.
const cashOut: ChalkMdpSpec = {
  kind: 'chalk-mdp',
  states: [{ id: 's' }, { id: 'done', terminal: true }],
  actions: [
    { from: 's', name: 'go', outcomes: [{ to: 'done', p: 1, reward: 1 }] },
    { from: 's', name: 'stay', outcomes: [{ to: 's', p: 1, reward: 0.5 }] },
  ],
};

describe('valueIteration', () => {
  it('starts every value at zero with no policy', () => {
    const [first] = valueIteration(cashOut, 0.9);
    expect(first.sweep).toBe(0);
    expect(first.V).toEqual({ s: 0, done: 0 });
    expect(first.policy).toEqual({ s: null, done: null });
  });

  it('applies one synchronous Bellman backup per sweep', () => {
    const frames = valueIteration(cashOut, 0.9);
    expect(frames[1].V.s).toBeCloseTo(1); // max(1 + 0, 0.5 + 0.9*0)
    expect(frames[1].policy.s).toBe(0); // go
    expect(frames[2].V.s).toBeCloseTo(1.4); // max(1, 0.5 + 0.9*1)
    expect(frames[2].policy.s).toBe(1); // stay
    expect(frames[2].Q).toEqual([expect.closeTo(1), expect.closeTo(1.4)]);
  });

  it('converges to the fixed point and records the shrinking change per sweep', () => {
    const frames = valueIteration(cashOut, 0.9);
    const last = frames.at(-1)!;
    expect(last.V.s).toBeCloseTo(5, 4);
    expect(last.delta).toBeLessThan(1e-6);
    expect(frames[2].delta).toBeGreaterThan(frames[3].delta);
  });

  it('keeps terminal states at zero', () => {
    for (const f of valueIteration(cashOut, 0.9)) expect(f.V.done).toBe(0);
  });

  it('with gamma 0 only the immediate reward matters', () => {
    const last = valueIteration(cashOut, 0).at(-1)!;
    expect(last.V.s).toBeCloseTo(1);
    expect(last.policy.s).toBe(0);
  });

  it('treats a state with no actions like a terminal state', () => {
    const dead: ChalkMdpSpec = { kind: 'chalk-mdp', states: [{ id: 'x' }], actions: [] };
    const last = valueIteration(dead, 0.9).at(-1)!;
    expect(last.V.x).toBe(0);
    expect(last.policy.x).toBeNull();
  });

  it('stops at maxSweeps even if not converged', () => {
    expect(valueIteration(cashOut, 0.9, { maxSweeps: 5 })).toHaveLength(6);
  });
});

describe('bellmanBackup', () => {
  const risky: ChalkMdpSpec = {
    kind: 'chalk-mdp',
    states: [{ id: 's' }, { id: 't', terminal: true }],
    actions: [
      {
        from: 's',
        name: 'gamble',
        outcomes: [
          { to: 't', p: 0.5, reward: 10 },
          { to: 's', p: 0.5 },
        ],
      },
    ],
  };

  it('breaks an action value into p × (reward + γ·V(next)) terms', () => {
    const { terms, total } = bellmanBackup(risky, { s: 2, t: 0 }, 0, 0.9);
    expect(terms).toEqual([
      { to: 't', p: 0.5, reward: 10, nextValue: 0, contribution: expect.closeTo(5) },
      { to: 's', p: 0.5, reward: 0, nextValue: 2, contribution: expect.closeTo(0.9) },
    ]);
    expect(total).toBeCloseTo(5.9);
  });
});

describe('validateMdp', () => {
  it('accepts a valid MDP', () => {
    expect(validateMdp(cashOut)).toEqual([]);
  });

  it('reports outcome probabilities that do not sum to 1 and unknown states', () => {
    const errors = validateMdp({
      ...cashOut,
      actions: [{ from: 's', name: 'go', outcomes: [{ to: 'nowhere', p: 0.4 }] }],
    }).join(' ');
    expect(errors).toContain('nowhere');
    expect(errors).toContain('sum');
  });

  it('reports a gamma outside [0, 1]', () => {
    expect(validateMdp({ ...cashOut, gamma: 1.5 }).join(' ')).toContain('gamma');
  });
});
