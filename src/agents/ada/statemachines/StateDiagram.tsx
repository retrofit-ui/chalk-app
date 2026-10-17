import { type Component, For, Show, createMemo } from 'solid-js';
import { color } from '../palette';
import { entryAngle, layoutStates, routeEdges, type Point } from './layout';

// The one drawing all four state-machine kinds share: circles for states, arrows for
// transitions, loops for self-transitions. Each kind supplies styling callbacks (what is
// active, visited, on the path…) and the diagram stays dumb.

export type DiagramSize = 'small' | 'medium' | 'large';

export const DIAGRAM_DIMS: Record<DiagramSize, { unit: number; radius: number; font: number }> = {
  small: { unit: 100, radius: 20, font: 11 },
  medium: { unit: 130, radius: 26, font: 13 },
  large: { unit: 160, radius: 32, font: 15 },
};

export type DiagramState = { id: string; label?: string; x?: number; y?: number; colorIndex?: number };
export type DiagramEdge = { from: string; to: string; label?: string };

export type NodeLook = { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number; text?: string };
export type EdgeLook = { stroke?: string; width?: number; opacity?: number; dashed?: boolean; labelColor?: string };

export const INK = '#334155'; // slate-700
export const MUTED = '#94a3b8'; // slate-400
export const ACCENT = '#2563eb'; // palette blue
export const GOOD = '#16a34a'; // palette green
export const BAD = '#dc2626'; // palette red
export const WARM = '#d97706'; // palette amber

let _nextId = 0;

const StateDiagram: Component<{
  states: DiagramState[];
  edges: DiagramEdge[];
  size?: DiagramSize;
  start?: string; // draws an entry arrow into this state
  accepting?: Set<string>; // drawn as double circles
  node?: (id: string) => NodeLook;
  caption?: (id: string) => string | undefined; // small line under the circle
  edge?: (index: number) => EdgeLook;
  token?: string | null; // a marker that glides between states (Markov random walk)
  onNodeEnter?: (id: string) => void;
  onNodeLeave?: (id: string) => void;
  onNodeClick?: (id: string) => void;
}> = (props) => {
  const uid = `sd-${_nextId++}`;
  const dims = () => DIAGRAM_DIMS[props.size ?? 'medium'];
  const layout = createMemo(() => layoutStates(props.states, dims().unit, dims().radius));
  const routes = createMemo(() => routeEdges(props.edges, layout().positions, dims().radius));
  const pos = (id: string): Point => layout().positions.get(id) ?? { x: 0, y: 0 };
  // Extra room at the bottom for captions under the lowest row.
  const height = () => layout().height + (props.caption ? dims().font * 1.6 : 0);

  const markerColors = createMemo(() => {
    const set = new Set<string>([INK, MUTED]);
    props.edges.forEach((_, i) => set.add(props.edge?.(i).stroke ?? MUTED));
    return [...set];
  });
  const markerId = (c: string) => `${uid}-arrow-${c.replace(/[^a-z0-9]/gi, '')}`;

  const entry = () => {
    if (!props.start || !layout().positions.has(props.start)) return null;
    const p = pos(props.start);
    const r = dims().radius;
    // a caption sits straight below every state, so don't bring the arrow in from there
    const a = entryAngle(props.start, layout().positions, props.edges, props.caption ? [Math.PI / 2] : []);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    return { x1: p.x + dx * r * 2.2, y1: p.y + dy * r * 2.2, x2: p.x + dx * (r + 2), y2: p.y + dy * (r + 2) };
  };

  return (
    <svg
      class="block rounded-md bg-white select-none"
      viewBox={`0 0 ${layout().width} ${height()}`}
      width={layout().width}
      style={{ 'max-width': '100%', height: 'auto' }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
    >
      <defs>
        <For each={markerColors()}>
          {(c) => (
            <marker id={markerId(c)} markerWidth="10" markerHeight="10" refX="8.5" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
              <path d="M0,0 L10,5 L0,10 z" fill={c} />
            </marker>
          )}
        </For>
      </defs>

      <Show when={entry()}>
        {(e) => (
          <line
            data-testid="start-arrow"
            x1={e().x1}
            y1={e().y1}
            x2={e().x2}
            y2={e().y2}
            stroke={INK}
            stroke-width={1.75}
            marker-end={`url(#${markerId(INK)})`}
          />
        )}
      </Show>

      <For each={routes()}>
        {(route, i) => {
          const look = () => props.edge?.(i()) ?? {};
          const stroke = () => look().stroke ?? MUTED;
          return (
            <Show when={route.shape !== 'missing'}>
              <g data-edge={i()} style={{ opacity: look().opacity ?? 1, transition: 'opacity 150ms' }}>
                <path
                  d={route.d}
                  fill="none"
                  stroke={stroke()}
                  stroke-width={look().width ?? 1.5}
                  stroke-dasharray={look().dashed ? '5 4' : undefined}
                  marker-end={`url(#${markerId(stroke())})`}
                  style={{ transition: 'stroke 150ms, stroke-width 150ms' }}
                />
                <Show when={props.edges[i()]?.label}>
                  <text
                    x={route.label.x}
                    y={route.label.y}
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size={String(dims().font - 1)}
                    fill={look().labelColor ?? INK}
                    stroke="white"
                    stroke-width={4}
                    style={{ "paint-order": "stroke" }}
                    class="font-mono"
                  >
                    {props.edges[i()].label}
                  </text>
                </Show>
              </g>
            </Show>
          );
        }}
      </For>

      <For each={props.states}>
        {(s) => {
          const look = () => props.node?.(s.id) ?? {};
          const p = () => pos(s.id);
          const r = () => dims().radius;
          const baseStroke = () => (s.colorIndex !== undefined ? color(s.colorIndex) : INK);
          return (
            <g
              data-state={s.id}
              class="cursor-pointer"
              style={{ opacity: look().opacity ?? 1, transition: 'opacity 150ms' }}
              onMouseEnter={() => props.onNodeEnter?.(s.id)}
              onMouseLeave={() => props.onNodeLeave?.(s.id)}
              onClick={() => props.onNodeClick?.(s.id)}
            >
              <circle
                cx={p().x}
                cy={p().y}
                r={r()}
                fill={look().fill ?? 'white'}
                stroke={look().stroke ?? baseStroke()}
                stroke-width={look().strokeWidth ?? 1.75}
                style={{ transition: 'fill 200ms, stroke 200ms' }}
              />
              <Show when={props.accepting?.has(s.id)}>
                <circle
                  data-testid="accept-ring"
                  cx={p().x}
                  cy={p().y}
                  r={r() - 4}
                  fill="none"
                  stroke={look().stroke ?? baseStroke()}
                  stroke-width={1.25}
                />
              </Show>
              <text
                x={p().x}
                y={p().y}
                text-anchor="middle"
                dominant-baseline="central"
                font-size={String(dims().font)}
                font-weight="600"
                fill={look().text ?? INK}
              >
                {s.label ?? s.id}
              </text>
              <Show when={props.caption?.(s.id)}>
                {(cap) => (
                  <text
                    x={p().x}
                    y={p().y + r() + dims().font + 1}
                    text-anchor="middle"
                    font-size={String(dims().font - 2)}
                    fill="#475569"
                    stroke="white"
                    stroke-width={3}
                    style={{ "paint-order": "stroke" }}
                    class="font-mono"
                    data-testid="state-caption"
                  >
                    {cap()}
                  </text>
                )}
              </Show>
            </g>
          );
        }}
      </For>

      <Show when={props.token && layout().positions.has(props.token)}>
        <circle
          data-testid="walk-token"
          r={dims().radius * 0.32}
          cx={0}
          cy={0}
          fill={WARM}
          stroke="white"
          stroke-width={2}
          style={{
            transform: `translate(${pos(props.token!).x + dims().radius * 0.7}px, ${pos(props.token!).y - dims().radius * 0.7}px)`,
            transition: 'transform 260ms ease-in-out',
            'pointer-events': 'none',
          }}
        />
      </Show>
    </svg>
  );
};

export default StateDiagram;
