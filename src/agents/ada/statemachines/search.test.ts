import { describe, it, expect } from 'vitest';
import type { ChalkSearchSpec } from '../spec';
import { runSearch, costToGoal, checkHeuristic, validateSearch, defaultAlgorithm } from './search';

// S -1-> A -2-> B -1-> G is the cheapest route (cost 4); S -> A -> G and S -> B -> G are
// fewer hops but cost more, which is what separates BFS, greedy, Dijkstra and A*.
const base: ChalkSearchSpec = {
  kind: 'chalk-search',
  start: 'S',
  goal: 'G',
  states: [
    { id: 'S', h: 3 },
    { id: 'A', h: 2 },
    { id: 'B', h: 1 },
    { id: 'G', h: 0 },
  ],
  edges: [
    { from: 'S', to: 'A', cost: 1 },
    { from: 'S', to: 'B', cost: 4 },
    { from: 'A', to: 'B', cost: 2 },
    { from: 'A', to: 'G', cost: 5 },
    { from: 'B', to: 'G', cost: 1 },
  ],
};

const expandedOrder = (spec: ChalkSearchSpec, algo: Parameters<typeof runSearch>[1]) =>
  runSearch(spec, algo)
    .map((f) => f.expanded)
    .filter(Boolean);

describe('runSearch', () => {
  it('starts with only the start state on the frontier and nothing expanded', () => {
    const [first] = runSearch(base, 'astar');
    expect(first.expanded).toBeNull();
    expect(first.frontier).toEqual([{ id: 'S', g: 0, h: 3, f: 3 }]);
    expect(first.closed).toEqual([]);
    expect(first.done).toBe(false);
  });

  it('Dijkstra expands in order of cost so far and finds the cheapest path', () => {
    expect(expandedOrder(base, 'dijkstra')).toEqual(['S', 'A', 'B', 'G']);
    const last = runSearch(base, 'dijkstra').at(-1)!;
    expect(last.done).toBe(true);
    expect(last.path).toEqual(['S', 'A', 'B', 'G']);
    expect(last.pathCost).toBe(4);
  });

  it('BFS expands by hop count and returns the fewest-hops path, which costs more here', () => {
    expect(expandedOrder(base, 'bfs')).toEqual(['S', 'A', 'B', 'G']);
    const last = runSearch(base, 'bfs').at(-1)!;
    expect(last.path).toEqual(['S', 'A', 'G']);
    expect(last.pathCost).toBe(6);
  });

  it('greedy best-first chases the heuristic and settles for a worse path', () => {
    expect(expandedOrder(base, 'greedy')).toEqual(['S', 'B', 'G']);
    expect(runSearch(base, 'greedy').at(-1)!.path).toEqual(['S', 'B', 'G']);
  });

  it('A* orders by g + h, updates a cheaper route to a frontier state, and is optimal', () => {
    const frames = runSearch(base, 'astar');
    // after expanding A, B's entry dropped from g=4 to g=3 via A
    const afterA = frames.find((f) => f.expanded === 'A')!;
    expect(afterA.frontier.find((e) => e.id === 'B')).toEqual({ id: 'B', g: 3, h: 1, f: 4 });
    expect(frames.at(-1)!.path).toEqual(['S', 'A', 'B', 'G']);
    expect(frames.at(-1)!.pathCost).toBe(4);
  });

  it('keeps the frontier sorted in the order the algorithm will pop it', () => {
    const afterS = runSearch(base, 'astar').find((f) => f.expanded === 'S')!;
    expect(afterS.frontier.map((e) => e.id)).toEqual(['A', 'B']); // f 3 before f 5
  });

  it('reports which edges were examined in each step', () => {
    const afterS = runSearch(base, 'dijkstra').find((f) => f.expanded === 'S')!;
    expect(afterS.examined.sort()).toEqual([0, 1]);
  });

  it('ends with no path when the goal is unreachable', () => {
    const cut = { ...base, edges: base.edges.filter((e) => e.to !== 'G') };
    const last = runSearch(cut, 'dijkstra').at(-1)!;
    expect(last.done).toBe(true);
    expect(last.path).toBeNull();
    expect(last.frontier).toEqual([]);
  });

  it('treats edges as two-way when directed is false', () => {
    const reversed: ChalkSearchSpec = {
      ...base,
      directed: false,
      edges: base.edges.map((e) => ({ ...e, from: e.to, to: e.from })),
    };
    expect(runSearch(reversed, 'dijkstra').at(-1)!.pathCost).toBe(4);
  });

  it('defaults missing costs to 1 and missing h to 0', () => {
    const plain: ChalkSearchSpec = {
      kind: 'chalk-search',
      start: 'a',
      goal: 'c',
      states: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    };
    const last = runSearch(plain, 'astar').at(-1)!;
    expect(last.pathCost).toBe(2);
    expect(runSearch(plain, 'astar')[0].frontier[0]).toEqual({ id: 'a', g: 0, h: 0, f: 0 });
  });

  it('breaks priority ties first-in first-out so runs are reproducible', () => {
    const tie: ChalkSearchSpec = {
      kind: 'chalk-search',
      start: 's',
      goal: 'z',
      states: [{ id: 's' }, { id: 'x' }, { id: 'y' }, { id: 'z' }],
      edges: [
        { from: 's', to: 'x' },
        { from: 's', to: 'y' },
        { from: 'y', to: 'z' },
      ],
    };
    expect(expandedOrder(tie, 'dijkstra')).toEqual(['s', 'x', 'y', 'z']);
  });
});

describe('costToGoal', () => {
  it('gives the true cheapest remaining cost from every state', () => {
    expect(costToGoal(base)).toEqual({ S: 4, A: 3, B: 1, G: 0 });
  });

  it('is Infinity for states that cannot reach the goal', () => {
    const cut = { ...base, edges: [...base.edges, { from: 'G', to: 'D' }], states: [...base.states, { id: 'D' }] };
    expect(costToGoal(cut).D).toBe(Infinity);
  });
});

describe('checkHeuristic', () => {
  it('finds nothing wrong with an admissible, consistent heuristic', () => {
    expect(checkHeuristic(base)).toEqual({ overestimates: [], inconsistent: [] });
  });

  it('flags states whose h overestimates the true remaining cost, and edges where h drops too fast', () => {
    const bad = { ...base, states: base.states.map((s) => (s.id === 'B' ? { ...s, h: 5 } : s)) };
    const report = checkHeuristic(bad);
    expect(report.overestimates).toEqual([{ id: 'B', h: 5, trueCost: 1 }]);
    expect(report.inconsistent).toEqual([4]); // B -1-> G: h(B)=5 > 1 + h(G)
  });

  it('shows the consequence: A* with an overestimating h can return a costlier path', () => {
    const bad = { ...base, states: base.states.map((s) => (s.id === 'B' ? { ...s, h: 5 } : s)) };
    expect(runSearch(bad, 'astar').at(-1)!.pathCost).toBeGreaterThan(4);
  });
});

describe('defaultAlgorithm', () => {
  it('is A* when any state carries a heuristic, Dijkstra otherwise', () => {
    expect(defaultAlgorithm(base)).toBe('astar');
    expect(defaultAlgorithm({ ...base, states: base.states.map(({ h: _h, ...s }) => s) })).toBe('dijkstra');
  });
});

describe('validateSearch', () => {
  it('accepts a well-formed graph', () => {
    expect(validateSearch(base)).toEqual([]);
  });

  it('reports unknown start/goal, dangling edges and negative costs', () => {
    const errors = validateSearch({
      ...base,
      start: 'nope',
      goal: 'gone',
      edges: [
        { from: 'S', to: 'ghost' },
        { from: 'S', to: 'A', cost: -1 },
      ],
    });
    expect(errors.join(' ')).toContain('nope');
    expect(errors.join(' ')).toContain('gone');
    expect(errors.join(' ')).toContain('ghost');
    expect(errors.join(' ')).toContain('negative');
  });
});
