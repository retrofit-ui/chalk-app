import type { ComputeGraphEdge } from './spec';

// Pure graph traversal, extracted for testability (no Solid/DOM involved).
//
// Given the edge list of a chalk-compute-graph spec and the id of the node currently
// hovered/tapped, returns every node reachable by walking edges backward from it
// ("ancestors" — its full causal history) and every node reachable by walking edges
// forward ("descendants" — everything it affects). Both traversals use a visited set
// (BFS), so a cyclic edge list — which the LLM should not normally emit for a
// dependency graph, but which isn't validated against here — terminates instead of
// looping forever; a node reachable only via a cycle back to the hovered node itself
// will show up in its own ancestor/descendant set, which is an acceptable degenerate
// result for input that shouldn't occur in practice.

export type ComputeGraphTraversalResult = {
  ancestors: Set<string>;
  descendants: Set<string>;
};

const buildAdjacency = (
  edges: ComputeGraphEdge[],
): { forward: Map<string, string[]>; backward: Map<string, string[]> } => {
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const edge of edges) {
    if (!forward.has(edge.from)) forward.set(edge.from, []);
    forward.get(edge.from)!.push(edge.to);
    if (!backward.has(edge.to)) backward.set(edge.to, []);
    backward.get(edge.to)!.push(edge.from);
  }
  return { forward, backward };
};

const bfsFrom = (startId: string, adjacency: Map<string, string[]>): Set<string> => {
  const visited = new Set<string>();
  const queue: string[] = [...(adjacency.get(startId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
};

export function traverseComputeGraph(
  edges: ComputeGraphEdge[],
  hoveredId: string,
): ComputeGraphTraversalResult {
  const { forward, backward } = buildAdjacency(edges);
  return {
    ancestors: bfsFrom(hoveredId, backward),
    descendants: bfsFrom(hoveredId, forward),
  };
}
