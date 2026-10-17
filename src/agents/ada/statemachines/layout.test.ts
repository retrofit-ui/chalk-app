import { describe, it, expect } from 'vitest';
import { entryAngle, layoutStates, routeEdges } from './layout';

const UNIT = 120;
const R = 28;

describe('layoutStates', () => {
  it('maps grid coordinates to pixels, offset so the top-left state sits at the padding', () => {
    const { positions, width, height, padding } = layoutStates(
      [
        { id: 'a', x: 1, y: 2 },
        { id: 'b', x: 3, y: 2 },
        { id: 'c', x: 2, y: 3 },
      ],
      UNIT,
      R,
    );
    expect(positions.get('a')).toEqual({ x: padding, y: padding });
    expect(positions.get('b')).toEqual({ x: padding + 2 * UNIT, y: padding });
    expect(positions.get('c')).toEqual({ x: padding + UNIT, y: padding + UNIT });
    expect(width).toBe(2 * UNIT + 2 * padding);
    expect(height).toBe(UNIT + 2 * padding);
  });

  it('falls back to a circle when any state lacks a position', () => {
    const states = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    const { positions, width, height } = layoutStates([...states.slice(0, 4), { id: 'e', x: 5 }], UNIT, R);
    const cx = width / 2;
    const cy = height / 2;
    const dists = [...positions.values()].map((p) => Math.hypot(p.x - cx, p.y - cy));
    for (const d of dists) expect(d).toBeCloseTo(dists[0], 6);
    expect(new Set([...positions.values()].map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)).size).toBe(5);
    // first state at twelve o'clock
    expect(positions.get('a')!.x).toBeCloseTo(cx, 6);
    expect(positions.get('a')!.y).toBeLessThan(cy);
  });

  it('places a single state without a position at the centre', () => {
    const { positions, width, height } = layoutStates([{ id: 'only' }], UNIT, R);
    expect(positions.get('only')).toEqual({ x: width / 2, y: height / 2 });
  });
});

describe('routeEdges', () => {
  const positions = new Map([
    ['a', { x: 0, y: 0 }],
    ['b', { x: 100, y: 0 }],
  ]);

  it('draws a lone edge as a straight line between the circle boundaries', () => {
    const [r] = routeEdges([{ from: 'a', to: 'b' }], positions, 10);
    expect(r.shape).toBe('line');
    expect(r.start.x).toBeCloseTo(10);
    expect(r.start.y).toBeCloseTo(0);
    expect(r.end.x).toBeCloseTo(90);
    expect(r.label.y).toBeCloseTo(0);
  });

  it('bends a reciprocal pair apart so their labels sit on opposite sides', () => {
    const [ab, ba] = routeEdges(
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
      positions,
      10,
    );
    expect(ab.shape).toBe('arc');
    expect(ba.shape).toBe('arc');
    expect(Math.sign(ab.label.y)).toBe(-Math.sign(ba.label.y));
    expect(Math.abs(ab.label.y)).toBeGreaterThan(5);
  });

  it('separates parallel edges in the same direction', () => {
    const [e1, e2] = routeEdges(
      [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'b' },
      ],
      positions,
      10,
    );
    expect(e1.label.y).not.toBeCloseTo(e2.label.y, 1);
  });

  it('keeps every endpoint on the circle boundary, even for arcs', () => {
    const routes = routeEdges(
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
      positions,
      10,
    );
    for (const r of routes) {
      const from = positions.get(r.from)!;
      const to = positions.get(r.to)!;
      expect(Math.hypot(r.start.x - from.x, r.start.y - from.y)).toBeCloseTo(10, 6);
      expect(Math.hypot(r.end.x - to.x, r.end.y - to.y)).toBeCloseTo(10, 6);
    }
  });

  it('draws a self-transition as a loop with its label above the state', () => {
    const [loop] = routeEdges([{ from: 'a', to: 'a' }], positions, 10);
    expect(loop.shape).toBe('loop');
    expect(loop.label.y).toBeLessThan(-10);
    expect(loop.d.startsWith('M')).toBe(true);
  });

  it('fans several self-loops on one state out to distinct angles', () => {
    const loops = routeEdges(
      [
        { from: 'a', to: 'a' },
        { from: 'a', to: 'a' },
      ],
      positions,
      10,
    );
    expect(loops[0].label.x).not.toBeCloseTo(loops[1].label.x, 1);
  });

  it('skips edges whose endpoints have no position, reporting them as missing', () => {
    const routes = routeEdges([{ from: 'a', to: 'zzz' }], positions, 10);
    expect(routes).toHaveLength(1);
    expect(routes[0].shape).toBe('missing');
  });
});

describe('entryAngle', () => {
  const pos = new Map([
    ['l', { x: 0, y: 100 }],
    ['m', { x: 100, y: 100 }],
    ['r', { x: 200, y: 100 }],
  ]);

  it('comes in from the left when nothing is there', () => {
    expect(entryAngle('l', pos, [{ from: 'l', to: 'm' }])).toBeCloseTo(Math.PI);
  });

  it('avoids the directions of the state’s own edges and self-loop', () => {
    const a = entryAngle('m', pos, [
      { from: 'l', to: 'm' },
      { from: 'm', to: 'r' },
      { from: 'm', to: 'm' }, // loop sits at twelve o'clock
    ]);
    // left, right and up are taken: the entry arrow comes from below
    expect(Math.cos(a)).toBeCloseTo(0, 6);
    expect(Math.sin(a)).toBeGreaterThan(0);
  });

  it('also avoids neighbouring states that have no edge to it', () => {
    const a = entryAngle('m', pos, []);
    expect(Math.abs(Math.cos(a))).toBeLessThan(0.99); // not straight at l or r
  });
});

describe('entryAngle preference', () => {
  it('keeps the textbook left-hand arrow when the left is reasonably clear, even with a self-loop above', () => {
    const pos = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 100, y: 0 }],
    ]);
    expect(entryAngle('a', pos, [{ from: 'a', to: 'a' }, { from: 'a', to: 'b' }])).toBeCloseTo(Math.PI);
  });
});

describe('entryAngle extra obstacles', () => {
  it('treats caller-supplied directions (e.g. a caption under the state) as taken', () => {
    const pos = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 100, y: 0 }],
    ]);
    const a = entryAngle('b', pos, [{ from: 'b', to: 'b' }], [Math.PI / 2]);
    expect(a).toBeCloseTo(0); // a on the left, loop above, caption below → from the right
  });
});
