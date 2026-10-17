// Pure geometry for the state-diagram family: where each state circle sits, and how each
// transition is drawn between (or around) them. No DOM — unit-tested in layout.test.ts.

export type Point = { x: number; y: number };

export type Positioned = { id: string; x?: number; y?: number };

export type Layout = {
  positions: Map<string, Point>;
  width: number;
  height: number;
  padding: number;
};

/**
 * Grid coordinates (x = column, y = row, fractions allowed) become pixels `unit` apart. If any
 * state lacks a position, all of them go on a circle instead — a partial layout is more likely
 * an omission than a design, and mixing the two would overlap.
 */
export function layoutStates(states: Positioned[], unit: number, radius: number): Layout {
  // Room for a self-loop and its label above/beside the outermost states.
  const padding = Math.round(radius * 3.4);
  const positions = new Map<string, Point>();
  const gridded = states.length > 0 && states.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y));

  if (gridded) {
    const minX = Math.min(...states.map((s) => s.x!));
    const minY = Math.min(...states.map((s) => s.y!));
    const maxX = Math.max(...states.map((s) => s.x!));
    const maxY = Math.max(...states.map((s) => s.y!));
    for (const s of states) {
      positions.set(s.id, { x: padding + (s.x! - minX) * unit, y: padding + (s.y! - minY) * unit });
    }
    return { positions, width: (maxX - minX) * unit + 2 * padding, height: (maxY - minY) * unit + 2 * padding, padding };
  }

  const n = states.length;
  // Neighbouring states roughly `unit` apart along the circle, never tighter than a small ring.
  const ring = n <= 1 ? 0 : Math.max(unit * 0.75, (n * unit) / (2 * Math.PI));
  const size = 2 * ring + 2 * padding;
  states.forEach((s, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1);
    positions.set(s.id, { x: size / 2 + ring * Math.cos(angle), y: size / 2 + ring * Math.sin(angle) });
  });
  return { positions, width: size, height: size, padding };
}

export type EdgeRef = { from: string; to: string };

export type Route = {
  from: string;
  to: string;
  shape: 'line' | 'arc' | 'loop' | 'missing';
  d: string; // SVG path
  start: Point;
  end: Point;
  label: Point;
};

const onCircle = (c: Point, toward: Point, r: number): Point => {
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: c.x + (dx / len) * r, y: c.y + (dy / len) * r };
};

const fmt = (n: number) => Number(n.toFixed(2));

/**
 * Edges between the same unordered pair share "lanes": a lone edge is straight, two edges
 * (reciprocal or parallel) bow to opposite sides, three get straight + both sides, and so on.
 * Lanes are measured in the pair's canonical direction, so A→B and B→A end up on opposite
 * sides automatically. Self-loops on one state fan out from twelve o'clock.
 */
export function routeEdges(edges: EdgeRef[], positions: Map<string, Point>, radius: number): Route[] {
  const groups = new Map<string, number[]>();
  const loops = new Map<string, number[]>();
  edges.forEach((e, i) => {
    if (e.from === e.to) {
      loops.set(e.from, [...(loops.get(e.from) ?? []), i]);
    } else {
      const key = e.from < e.to ? `${e.from}\u0000${e.to}` : `${e.to}\u0000${e.from}`;
      groups.set(key, [...(groups.get(key) ?? []), i]);
    }
  });

  const lane = new Map<number, number>();
  for (const members of groups.values()) {
    members.forEach((idx, k) => lane.set(idx, k - (members.length - 1) / 2));
  }
  const loopSlot = new Map<number, number>();
  for (const members of loops.values()) members.forEach((idx, k) => loopSlot.set(idx, k));

  const bend = radius * 1.6;

  return edges.map((e, i) => {
    const a = positions.get(e.from);
    const b = positions.get(e.to);
    if (!a || !b) {
      const p = a ?? b ?? { x: 0, y: 0 };
      return { from: e.from, to: e.to, shape: 'missing', d: '', start: p, end: p, label: p };
    }

    if (e.from === e.to) {
      const k = loopSlot.get(i)!;
      const angle = -Math.PI / 2 + k * (Math.PI / 3.2);
      const spread = 0.42;
      const dir = (t: number): Point => ({ x: Math.cos(t), y: Math.sin(t) });
      const s = { x: a.x + dir(angle - spread).x * radius, y: a.y + dir(angle - spread).y * radius };
      const en = { x: a.x + dir(angle + spread).x * radius, y: a.y + dir(angle + spread).y * radius };
      const reach = radius * 2.9;
      const c1 = { x: a.x + dir(angle - spread * 1.6).x * reach, y: a.y + dir(angle - spread * 1.6).y * reach };
      const c2 = { x: a.x + dir(angle + spread * 1.6).x * reach, y: a.y + dir(angle + spread * 1.6).y * reach };
      const label = { x: a.x + dir(angle).x * radius * 2.55, y: a.y + dir(angle).y * radius * 2.55 };
      return {
        from: e.from,
        to: e.to,
        shape: 'loop',
        d: `M${fmt(s.x)},${fmt(s.y)} C${fmt(c1.x)},${fmt(c1.y)} ${fmt(c2.x)},${fmt(c2.y)} ${fmt(en.x)},${fmt(en.y)}`,
        start: s,
        end: en,
        label,
      };
    }

    const l = lane.get(i)!;
    // canonical direction for the pair, so lane signs mean the same side for both directions
    const [p, q] = e.from < e.to ? [a, b] : [b, a];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / len, y: dx / len };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    if (l === 0) {
      const s = onCircle(a, b, radius);
      const en = onCircle(b, a, radius);
      return {
        from: e.from,
        to: e.to,
        shape: 'line',
        d: `M${fmt(s.x)},${fmt(s.y)} L${fmt(en.x)},${fmt(en.y)}`,
        start: s,
        end: en,
        label: { x: (s.x + en.x) / 2, y: (s.y + en.y) / 2 },
      };
    }

    // quadratic control point; the curve's midpoint sits at half the control offset
    const offset = l * 2 * bend;
    const c = { x: mid.x + normal.x * offset, y: mid.y + normal.y * offset };
    const s = onCircle(a, c, radius);
    const en = onCircle(b, c, radius);
    const label = { x: 0.25 * s.x + 0.5 * c.x + 0.25 * en.x, y: 0.25 * s.y + 0.5 * c.y + 0.25 * en.y };
    return {
      from: e.from,
      to: e.to,
      shape: 'arc',
      d: `M${fmt(s.x)},${fmt(s.y)} Q${fmt(c.x)},${fmt(c.y)} ${fmt(en.x)},${fmt(en.y)}`,
      start: s,
      end: en,
      label,
    };
  });
}

const angleGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

// left first (the textbook convention), then the diagonals and verticals, right last
const ENTRY_CANDIDATES = [Math.PI, -0.75 * Math.PI, 0.75 * Math.PI, -0.5 * Math.PI, 0.5 * Math.PI, -0.25 * Math.PI, 0.25 * Math.PI, 0];

/**
 * Direction (radians, screen coordinates) for the start state's entry arrow: whichever
 * candidate is furthest from every edge, self-loop and neighbouring state around it. A fixed
 * "from the left" arrow lands on top of an edge whenever the start isn't the leftmost state,
 * and then reads as a transition.
 */
export function entryAngle(id: string, positions: Map<string, Point>, edges: EdgeRef[], avoid: number[] = []): number {
  const p = positions.get(id);
  if (!p) return Math.PI;
  const occupied: number[] = [...avoid];
  let loops = 0;
  for (const e of edges) {
    if (e.from === id && e.to === id) occupied.push(-Math.PI / 2 + loops++ * (Math.PI / 3.2));
  }
  for (const [other, q] of positions) {
    if (other !== id && (q.x !== p.x || q.y !== p.y)) occupied.push(Math.atan2(q.y - p.y, q.x - p.x));
  }
  const gapOf = (c: number) => (occupied.length ? Math.min(...occupied.map((o) => angleGap(c, o))) : Math.PI);
  // the first candidate (in preference order) with a right angle of clearance wins…
  const clear = ENTRY_CANDIDATES.find((c) => gapOf(c) >= Math.PI / 2 - 1e-9);
  if (clear !== undefined) return clear;
  // …otherwise whichever is least crowded
  let best = ENTRY_CANDIDATES[0];
  let bestGap = -1;
  for (const c of ENTRY_CANDIDATES) {
    const gap = gapOf(c);
    if (gap > bestGap + 1e-9) {
      best = c;
      bestGap = gap;
    }
  }
  return best;
}
