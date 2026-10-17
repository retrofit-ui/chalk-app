import type { ChalkAutomatonSpec, ChalkMarkovSpec, ChalkMdpSpec, ChalkSearchSpec } from '../../src/agents/ada/spec';

// Fixtures for the state-machine family. Small, with outcomes worked out by hand (and
// pinned by the engine unit tests), so the e2e tests can assert on the numbers shown.

export const evenOnes: ChalkAutomatonSpec = {
  kind: 'chalk-automaton',
  title: 'Even ones fixture',
  start: 'even',
  states: [
    { id: 'even', accept: true, x: 0, y: 0 },
    { id: 'odd', x: 2, y: 0 },
  ],
  transitions: [
    { from: 'even', to: 'even', symbols: ['0'] },
    { from: 'even', to: 'odd', symbols: ['1'] },
    { from: 'odd', to: 'odd', symbols: ['0'] },
    { from: 'odd', to: 'even', symbols: ['1'] },
  ],
  input: '101',
  examples: ['11', '1011'],
};

export const endsAb: ChalkAutomatonSpec = {
  kind: 'chalk-automaton',
  start: 'q0',
  states: [{ id: 'q0' }, { id: 'q1' }, { id: 'q2', accept: true }],
  transitions: [
    { from: 'q0', to: 'q0', symbols: ['a', 'b'] },
    { from: 'q0', to: 'q1', symbols: ['a'] },
    { from: 'q1', to: 'q2', symbols: ['b'] },
  ],
  input: 'aab',
};

export const brokenAutomaton = {
  kind: 'chalk-automaton',
  start: 'nowhere',
  states: [{ id: 'a' }],
  transitions: [],
};

export const search: ChalkSearchSpec = {
  kind: 'chalk-search',
  title: 'Search fixture',
  start: 'S',
  goal: 'G',
  states: [
    { id: 'S', h: 3, x: 0, y: 1 },
    { id: 'A', h: 2, x: 1, y: 0 },
    { id: 'B', h: 1, x: 1, y: 2 },
    { id: 'G', h: 0, x: 2, y: 1 },
  ],
  edges: [
    { from: 'S', to: 'A', cost: 1 },
    { from: 'S', to: 'B', cost: 4 },
    { from: 'A', to: 'B', cost: 2 },
    { from: 'A', to: 'G', cost: 5 },
    { from: 'B', to: 'G', cost: 1 },
  ],
  algorithm: 'bfs',
  editable: true,
};

export const weather: ChalkMarkovSpec = {
  kind: 'chalk-markov',
  title: 'Weather fixture',
  states: [
    { id: 'sunny', x: 0, y: 0 },
    { id: 'rainy', x: 2, y: 0 },
  ],
  transitions: [
    { from: 'sunny', to: 'sunny', p: 0.9 },
    { from: 'sunny', to: 'rainy', p: 0.1 },
    { from: 'rainy', to: 'sunny', p: 0.5 },
    { from: 'rainy', to: 'rainy', p: 0.5 },
  ],
  editable: true,
};

export const ruin: ChalkMarkovSpec = {
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
  start: '1',
};

export const cashOut: ChalkMdpSpec = {
  kind: 'chalk-mdp',
  title: 'MDP fixture',
  states: [
    { id: 'here', x: 0, y: 0 },
    { id: 'done', terminal: true, x: 2, y: 0 },
  ],
  actions: [
    { from: 'here', name: 'cash out', outcomes: [{ to: 'done', p: 1, reward: 1 }] },
    { from: 'here', name: 'collect', outcomes: [{ to: 'here', p: 1, reward: 0.5 }] },
  ],
  gamma: 0.9,
};
