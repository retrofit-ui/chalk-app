import type { ChalkSearchSpec, SearchAlgorithm } from '../spec';
import { checkRef, checkStates, stateIds } from './validate';

export type FrontierEntry = { id: string; g: number; h: number; f: number };

export type SearchFrame = {
  expanded: string | null; // state popped from the frontier in this step
  examined: number[]; // edge indices looked at while expanding it
  frontier: FrontierEntry[]; // in pop order
  closed: string[]; // expanded states, in expansion order
  g: Record<string, number>; // best known cost from the start
  parent: Record<string, string>;
  done: boolean;
  path: string[] | null; // set on the final frame when the goal was reached
  pathCost: number | null;
};

export const ALGORITHMS: SearchAlgorithm[] = ['bfs', 'dijkstra', 'greedy', 'astar'];

export const ALGORITHM_NAMES: Record<SearchAlgorithm, string> = {
  bfs: 'BFS',
  dijkstra: 'Dijkstra',
  greedy: 'Greedy',
  astar: 'A*',
};

export const defaultAlgorithm = (spec: ChalkSearchSpec): SearchAlgorithm =>
  spec.states.some((s) => typeof s.h === 'number') ? 'astar' : 'dijkstra';

type Arc = { to: string; cost: number; edge: number };

function adjacency(spec: ChalkSearchSpec, reverse = false): Map<string, Arc[]> {
  const adj = new Map<string, Arc[]>(spec.states.map((s) => [s.id, []]));
  const add = (from: string, to: string, cost: number, edge: number) => adj.get(from)?.push({ to, cost, edge });
  spec.edges.forEach((e, i) => {
    const cost = e.cost ?? 1;
    const directed = spec.directed ?? true;
    if (reverse) add(e.to, e.from, cost, i);
    else add(e.from, e.to, cost, i);
    if (!directed) {
      if (reverse) add(e.from, e.to, cost, i);
      else add(e.to, e.from, cost, i);
    }
  });
  return adj;
}

const hOf = (spec: ChalkSearchSpec) => {
  const h = new Map(spec.states.map((s) => [s.id, typeof s.h === 'number' ? s.h : 0]));
  return (id: string) => h.get(id) ?? 0;
};

/**
 * One loop, four algorithms — they differ only in how the frontier is ordered (the point
 * Red Blob Games and npretto's explainers make). BFS: first-in first-out. Dijkstra: by g.
 * Greedy: by h. A*: by g + h. Ties break first-in first-out. Graph search without
 * reopening closed states, so an inconsistent heuristic visibly costs A* its optimality.
 */
export function runSearch(spec: ChalkSearchSpec, algorithm: SearchAlgorithm): SearchFrame[] {
  const adj = adjacency(spec);
  const h = hOf(spec);
  let seq = 0;
  const entries = new Map<string, { g: number; seq: number }>();
  const g: Record<string, number> = { [spec.start]: 0 };
  const parent: Record<string, string> = {};
  const closed: string[] = [];

  const priority = (id: string, e: { g: number; seq: number }) => {
    switch (algorithm) {
      case 'bfs':
        return e.seq;
      case 'dijkstra':
        return e.g;
      case 'greedy':
        return h(id);
      case 'astar':
        return e.g + h(id);
    }
  };
  const sorted = (): FrontierEntry[] =>
    [...entries.entries()]
      .sort(([a, ea], [b, eb]) => priority(a, ea) - priority(b, eb) || ea.seq - eb.seq)
      .map(([id, e]) => ({ id, g: e.g, h: h(id), f: e.g + h(id) }));

  const snapshot = (expanded: string | null, examined: number[], done = false, path: string[] | null = null): SearchFrame => ({
    expanded,
    examined,
    frontier: sorted(),
    closed: [...closed],
    g: { ...g },
    parent: { ...parent },
    done,
    path,
    pathCost: path ? g[spec.goal] : null,
  });

  entries.set(spec.start, { g: 0, seq: seq++ });
  const frames = [snapshot(null, [])];
  const reconsider = algorithm === 'dijkstra' || algorithm === 'astar';

  while (entries.size > 0) {
    const [cur] = sorted();
    entries.delete(cur.id);
    closed.push(cur.id);

    if (cur.id === spec.goal) {
      const path = [cur.id];
      while (parent[path[0]] !== undefined) path.unshift(parent[path[0]]);
      frames.push(snapshot(cur.id, [], true, path));
      return frames;
    }

    const examined: number[] = [];
    for (const arc of adj.get(cur.id) ?? []) {
      examined.push(arc.edge);
      if (closed.includes(arc.to)) continue;
      const ng = g[cur.id] + arc.cost;
      const existing = entries.get(arc.to);
      if (!existing) {
        g[arc.to] = ng;
        parent[arc.to] = cur.id;
        entries.set(arc.to, { g: ng, seq: seq++ });
      } else if (reconsider && ng < existing.g) {
        g[arc.to] = ng;
        parent[arc.to] = cur.id;
        entries.set(arc.to, { g: ng, seq: seq++ });
      }
    }
    frames.push(snapshot(cur.id, examined, entries.size === 0));
  }
  return frames;
}

/** True cheapest remaining cost to the goal from every state (Dijkstra on reversed edges). */
export function costToGoal(spec: ChalkSearchSpec): Record<string, number> {
  const adj = adjacency(spec, true);
  const dist: Record<string, number> = Object.fromEntries(spec.states.map((s) => [s.id, Infinity]));
  dist[spec.goal] = 0;
  const done = new Set<string>();
  while (true) {
    let best: string | null = null;
    for (const id of Object.keys(dist)) if (!done.has(id) && dist[id] < Infinity && (best === null || dist[id] < dist[best])) best = id;
    if (best === null) break;
    done.add(best);
    for (const arc of adj.get(best) ?? []) dist[arc.to] = Math.min(dist[arc.to], dist[best] + arc.cost);
  }
  return dist;
}

export type HeuristicReport = {
  overestimates: Array<{ id: string; h: number; trueCost: number }>; // inadmissible
  inconsistent: number[]; // edge indices where h(u) > cost + h(v)
};

export function checkHeuristic(spec: ChalkSearchSpec): HeuristicReport {
  const truth = costToGoal(spec);
  const h = hOf(spec);
  const overestimates = spec.states
    .filter((s) => typeof s.h === 'number' && truth[s.id] < Infinity && s.h > truth[s.id] + 1e-9)
    .map((s) => ({ id: s.id, h: s.h!, trueCost: truth[s.id] }));
  const inconsistent: number[] = [];
  spec.edges.forEach((e, i) => {
    const c = e.cost ?? 1;
    const bad = h(e.from) > c + h(e.to) + 1e-9 || (spec.directed === false && h(e.to) > c + h(e.from) + 1e-9);
    if (bad) inconsistent.push(i);
  });
  return { overestimates, inconsistent };
}

export function validateSearch(spec: ChalkSearchSpec): string[] {
  const errors = checkStates(spec?.states);
  if (errors.length) return errors;
  const ids = stateIds(spec.states);
  errors.push(...checkRef(ids, spec.start, '`start`'), ...checkRef(ids, spec.goal, '`goal`'));
  if (!Array.isArray(spec.edges)) return [...errors, '`edges` must be an array.'];
  spec.edges.forEach((e, i) => {
    errors.push(...checkRef(ids, e.from, `Edge ${i + 1} \`from\``), ...checkRef(ids, e.to, `Edge ${i + 1} \`to\``));
    if (e.cost !== undefined && !(typeof e.cost === 'number' && e.cost >= 0)) {
      errors.push(`Edge ${i + 1} has a negative or non-numeric cost; these algorithms need costs ≥ 0.`);
    }
  });
  return errors;
}
