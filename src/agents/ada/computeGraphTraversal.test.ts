import { describe, it, expect } from 'vitest';
import { traverseComputeGraph } from './computeGraphTraversal';

describe('traverseComputeGraph', () => {
  it('walks a simple linear chain a -> b -> c -> d', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd' },
    ];

    expect(traverseComputeGraph(edges, 'c')).toEqual({
      ancestors: new Set(['a', 'b']),
      descendants: new Set(['d']),
    });
    expect(traverseComputeGraph(edges, 'a')).toEqual({
      ancestors: new Set(),
      descendants: new Set(['b', 'c', 'd']),
    });
    expect(traverseComputeGraph(edges, 'd')).toEqual({
      ancestors: new Set(['a', 'b', 'c']),
      descendants: new Set(),
    });
  });

  it('handles a branch — one node with two children', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
    ];

    expect(traverseComputeGraph(edges, 'a')).toEqual({
      ancestors: new Set(),
      descendants: new Set(['b', 'c']),
    });
    expect(traverseComputeGraph(edges, 'b')).toEqual({
      ancestors: new Set(['a']),
      descendants: new Set(),
    });
    // b and c are siblings, not connected to each other
    expect(traverseComputeGraph(edges, 'c').ancestors.has('b')).toBe(false);
  });

  it('handles a merge — two nodes feeding one', () => {
    const edges = [
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
    ];

    expect(traverseComputeGraph(edges, 'd')).toEqual({
      ancestors: new Set(['b', 'c']),
      descendants: new Set(),
    });
    expect(traverseComputeGraph(edges, 'b')).toEqual({
      ancestors: new Set(),
      descendants: new Set(['d']),
    });
  });

  it('handles a diamond (branch + merge together)', () => {
    // x -> y1 -> z, x -> y2 -> z
    const edges = [
      { from: 'x', to: 'y1' },
      { from: 'x', to: 'y2' },
      { from: 'y1', to: 'z' },
      { from: 'y2', to: 'z' },
    ];

    expect(traverseComputeGraph(edges, 'z')).toEqual({
      ancestors: new Set(['x', 'y1', 'y2']),
      descendants: new Set(),
    });
    expect(traverseComputeGraph(edges, 'x')).toEqual({
      ancestors: new Set(),
      descendants: new Set(['y1', 'y2', 'z']),
    });
  });

  it('returns empty ancestor/descendant sets for a node with no edges at all', () => {
    expect(traverseComputeGraph([], 'isolated')).toEqual({
      ancestors: new Set(),
      descendants: new Set(),
    });
  });

  it('returns empty sets for a node that exists but is unconnected to the given edges', () => {
    const edges = [{ from: 'a', to: 'b' }];
    expect(traverseComputeGraph(edges, 'isolated')).toEqual({
      ancestors: new Set(),
      descendants: new Set(),
    });
  });

  it('terminates on a cycle instead of looping forever, and includes cycle members', () => {
    // a -> b -> c -> a
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
    ];

    const result = traverseComputeGraph(edges, 'a');
    expect(result.ancestors).toEqual(new Set(['a', 'b', 'c']));
    expect(result.descendants).toEqual(new Set(['a', 'b', 'c']));
  });
});
