import { describe, it, expect } from 'vitest';
import type { ChalkAutomatonSpec } from '../spec';
import { tokenize, runAutomaton, isDeterministic, validateAutomaton, epsilonClosure } from './automaton';

// Accepts binary strings with an even number of 1s.
const evenOnes: ChalkAutomatonSpec = {
  kind: 'chalk-automaton',
  start: 'even',
  states: [
    { id: 'even', accept: true },
    { id: 'odd' },
  ],
  transitions: [
    { from: 'even', to: 'even', symbols: ['0'] },
    { from: 'even', to: 'odd', symbols: ['1'] },
    { from: 'odd', to: 'odd', symbols: ['0'] },
    { from: 'odd', to: 'even', symbols: ['1'] },
  ],
};

// NFA: strings over {a,b} ending in "ab".
const endsAb: ChalkAutomatonSpec = {
  kind: 'chalk-automaton',
  start: 'q0',
  states: [{ id: 'q0' }, { id: 'q1' }, { id: 'q2', accept: true }],
  transitions: [
    { from: 'q0', to: 'q0', symbols: ['a', 'b'] },
    { from: 'q0', to: 'q1', symbols: ['a'] },
    { from: 'q1', to: 'q2', symbols: ['b'] },
  ],
};

const turnstile: ChalkAutomatonSpec = {
  kind: 'chalk-automaton',
  start: 'locked',
  states: [{ id: 'locked', accept: true }, { id: 'unlocked' }],
  transitions: [
    { from: 'locked', to: 'unlocked', symbols: ['coin'] },
    { from: 'locked', to: 'locked', symbols: ['push'] },
    { from: 'unlocked', to: 'locked', symbols: ['push'] },
    { from: 'unlocked', to: 'unlocked', symbols: ['coin'] },
  ],
};

describe('tokenize', () => {
  it('reads single-character alphabets character by character, ignoring whitespace', () => {
    expect(tokenize(endsAb, 'ab ba')).toEqual(['a', 'b', 'b', 'a']);
  });

  it('splits word alphabets on whitespace and commas', () => {
    expect(tokenize(turnstile, 'coin, push  push')).toEqual(['coin', 'push', 'push']);
  });

  it('returns no tokens for empty input', () => {
    expect(tokenize(evenOnes, '')).toEqual([]);
  });
});

describe('runAutomaton', () => {
  it('produces one frame per consumed symbol plus the initial frame', () => {
    const frames = runAutomaton(evenOnes, ['1', '0', '1', '1']);
    expect(frames).toHaveLength(5);
    expect(frames.map((f) => f.active)).toEqual([['even'], ['odd'], ['odd'], ['even'], ['odd']]);
    expect(frames.map((f) => f.consumed)).toEqual([0, 1, 2, 3, 4]);
  });

  it('marks intermediate frames running and the last one accepted or rejected', () => {
    const rejected = runAutomaton(evenOnes, ['1', '0', '1', '1']);
    expect(rejected.slice(0, -1).every((f) => f.status === 'running')).toBe(true);
    expect(rejected.at(-1)!.status).toBe('rejected');
    expect(runAutomaton(evenOnes, ['1', '1']).at(-1)!.status).toBe('accepted');
  });

  it('accepts the empty string exactly when the start state accepts', () => {
    const frames = runAutomaton(evenOnes, []);
    expect(frames).toHaveLength(1);
    expect(frames[0].status).toBe('accepted');
  });

  it('records which transitions fired to reach each frame', () => {
    const frames = runAutomaton(evenOnes, ['1', '0']);
    expect(frames[0].fired).toEqual([]);
    expect(frames[1].fired).toEqual([1]); // even --1--> odd
    expect(frames[2].fired).toEqual([2]); // odd --0--> odd
  });

  it('tracks every active state of an NFA at once', () => {
    const frames = runAutomaton(endsAb, ['a', 'a', 'b']);
    expect(frames.map((f) => f.active)).toEqual([['q0'], ['q0', 'q1'], ['q0', 'q1'], ['q0', 'q2']]);
    expect(frames.at(-1)!.status).toBe('accepted');
  });

  it('stops and rejects as soon as no state is active, keeping the position it died at', () => {
    const frames = runAutomaton(evenOnes, ['1', '2', '0']);
    expect(frames).toHaveLength(3);
    expect(frames.at(-1)!.active).toEqual([]);
    expect(frames.at(-1)!.consumed).toBe(2);
    expect(frames.at(-1)!.status).toBe('rejected');
  });

  it('follows epsilon moves, written as "" or "ε"', () => {
    const eps: ChalkAutomatonSpec = {
      kind: 'chalk-automaton',
      start: 'a',
      states: [{ id: 'a' }, { id: 'b' }, { id: 'c', accept: true }],
      transitions: [
        { from: 'a', to: 'b', symbols: ['ε'] },
        { from: 'b', to: 'c', symbols: [''] },
      ],
    };
    expect(epsilonClosure(eps, ['a'])).toEqual(['a', 'b', 'c']);
    expect(runAutomaton(eps, [])[0]).toMatchObject({ active: ['a', 'b', 'c'], status: 'accepted' });
  });
});

describe('isDeterministic', () => {
  it('is true when every state has at most one move per symbol and no epsilon moves', () => {
    expect(isDeterministic(evenOnes)).toBe(true);
    expect(isDeterministic(turnstile)).toBe(true);
  });

  it('is false when a symbol leads to two states', () => {
    expect(isDeterministic(endsAb)).toBe(false);
  });

  it('is false when there is an epsilon move', () => {
    expect(
      isDeterministic({ ...evenOnes, transitions: [...evenOnes.transitions, { from: 'odd', to: 'even', symbols: ['ε'] }] }),
    ).toBe(false);
  });
});

describe('validateAutomaton', () => {
  it('has no errors for a well-formed machine', () => {
    expect(validateAutomaton(evenOnes)).toEqual([]);
  });

  it('reports an unknown start state and transitions to unknown states', () => {
    const errors = validateAutomaton({
      ...evenOnes,
      start: 'nope',
      transitions: [{ from: 'even', to: 'ghost', symbols: ['1'] }],
    });
    expect(errors.some((e) => e.includes('nope'))).toBe(true);
    expect(errors.some((e) => e.includes('ghost'))).toBe(true);
  });

  it('reports a missing states array instead of throwing', () => {
    expect(validateAutomaton({ kind: 'chalk-automaton' } as unknown as ChalkAutomatonSpec).length).toBeGreaterThan(0);
  });
});
