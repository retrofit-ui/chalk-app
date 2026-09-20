import { type Component, For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { SpecRenderer } from '@retrofit-ui/spa-solid-shoelace/components';
import type { RootSpec } from '@retrofit-ui/core';
import type { ChalkComputeGraphSpec, ComputeGraphEdge, ComputeGraphNode } from './spec';
import { PALETTE, color } from './palette';
import { traverseComputeGraph } from './computeGraphTraversal';

const ANCESTOR_ACCENT = PALETTE[0]; // blue — "causes" (edges/nodes leading into the hovered node)
const DESCENDANT_ACCENT = PALETTE[1]; // red — "effects" (edges/nodes the hovered node leads to)
const HOVER_BORDER = '#1e293b'; // slate-800, neutral strong border for the hovered node itself
const NEUTRAL_EDGE = '#94a3b8'; // slate-400
const DIM_EDGE = '#cbd5e1'; // slate-300
const DIM_OPACITY = 0.35;

// Box width/height/font-size scale by size, unlike chalk-graph's fixed SIZE_MAX_WIDTH
// container cap — the number of nodes/edges varies per spec, so there is no single
// sensible max width; the container scrolls instead (see the wrapping div below).
// `gap` is wide enough to fit a wrapped edge label (see the label foreignObject below)
// without it bleeding into the neighboring node boxes on either side — the previous,
// narrower gaps (30/44/60) were sized for a bare unlabeled arrow and let any real edge
// label text overlap both adjacent boxes.
const NODE_SIZE: Record<'small' | 'medium' | 'large', { width: number; height: number; fontSize: number; gap: number }> = {
  small: { width: 88, height: 52, fontSize: 11, gap: 64 },
  medium: { width: 112, height: 64, fontSize: 13, gap: 84 },
  large: { width: 140, height: 80, fontSize: 15, gap: 104 },
};

let _nextId = 0;

type NodeVisualState = 'hovered' | 'ancestor' | 'descendant' | 'dim' | 'neutral';

type EdgeLine = {
  key: string;
  edge: ComputeGraphEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  stroke: string;
  opacity: number;
};

type Rect = { left: number; top: number; width: number; height: number };

// Returns the point where a ray from `box`'s center toward `target` crosses the box's
// boundary — a box for style 'box', a circle inscribed in it for style 'circle'. Used to
// anchor edge endpoints at the visual edge of a node rather than at its center, so the
// arrowhead lands just outside the box instead of being hidden behind it.
const boundaryPoint = (box: Rect, style: 'box' | 'circle', target: { x: number; y: number }) => {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  if (style === 'circle') {
    const radius = Math.min(box.width, box.height) / 2;
    const dist = Math.hypot(dx, dy) || 1;
    return { x: cx + (dx / dist) * radius, y: cy + (dy / dist) * radius };
  }
  const halfW = box.width / 2;
  const halfH = box.height / 2;
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY, 1);
  return { x: cx + dx * scale, y: cy + dy * scale };
};

const ComputeGraph: Component<{ spec: ChalkComputeGraphSpec }> = (props) => {
  const markerId = `cg-arrow-${_nextId++}`;
  let containerEl!: HTMLDivElement;
  const nodeRefs = new Map<string, HTMLDivElement>();

  const [hoveredId, setHoveredId] = createSignal<string | null>(null);
  const [nodeRects, setNodeRects] = createSignal<Map<string, Rect>>(new Map());
  const [canvasSize, setCanvasSize] = createSignal({ width: 0, height: 0 });

  const direction = () => props.spec.direction ?? 'row';
  const size = () => props.spec.size ?? 'medium';
  const dims = () => NODE_SIZE[size()];
  const nodesById = createMemo(() => new Map(props.spec.nodes.map((n) => [n.id, n])));

  const maxLayer = () => props.spec.nodes.reduce((m, n) => Math.max(m, n.layer), 0);
  const maxSlot = () => props.spec.nodes.reduce((m, n) => Math.max(m, n.slot), 0);

  const measure = () => {
    if (!containerEl) return;
    const containerRect = containerEl.getBoundingClientRect();
    const next = new Map<string, Rect>();
    for (const [id, el] of nodeRefs) {
      const r = el.getBoundingClientRect();
      next.set(id, { left: r.left - containerRect.left, top: r.top - containerRect.top, width: r.width, height: r.height });
    }
    setNodeRects(next);
    setCanvasSize({ width: containerRect.width, height: containerRect.height });
  };

  onMount(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(containerEl);
    onCleanup(() => ro.disconnect());
  });

  // Re-measure whenever the set of nodes/edges changes (new spec, different graph) —
  // the ResizeObserver above handles size changes of the same graph (e.g. async KaTeX
  // reflow), this handles a wholesale replacement where node count/positions differ.
  createEffect(() => {
    props.spec.nodes;
    props.spec.edges;
    direction();
    size();
    queueMicrotask(measure);
  });

  const traversal = createMemo(() => {
    const h = hoveredId();
    if (!h) return null;
    return traverseComputeGraph(props.spec.edges, h);
  });

  const nodeState = (id: string): NodeVisualState => {
    const h = hoveredId();
    if (!h) return 'neutral';
    if (id === h) return 'hovered';
    const t = traversal();
    if (t?.ancestors.has(id)) return 'ancestor';
    if (t?.descendants.has(id)) return 'descendant';
    return 'dim';
  };

  const nodeBoxStyle = (node: ComputeGraphNode) => {
    const state = nodeState(node.id);
    const base: Record<string, string> = {
      width: `${dims().width}px`,
      'font-size': `${dims().fontSize}px`,
    };
    if (node.style === 'circle') {
      base['aspect-ratio'] = '1';
      base['border-radius'] = '9999px';
    } else {
      base['min-height'] = `${dims().height}px`;
      base['border-radius'] = '0.5rem';
    }
    const accent = node.colorIndex !== undefined ? color(node.colorIndex) : '#334155';
    switch (state) {
      case 'hovered':
        base['border-width'] = '2px';
        base['border-color'] = HOVER_BORDER;
        base['background-color'] = '#f8fafc';
        base.opacity = '1';
        break;
      case 'ancestor':
        base['border-width'] = '2px';
        base['border-color'] = ANCESTOR_ACCENT;
        base['background-color'] = `${ANCESTOR_ACCENT}14`;
        base.opacity = '1';
        break;
      case 'descendant':
        base['border-width'] = '2px';
        base['border-color'] = DESCENDANT_ACCENT;
        base['background-color'] = `${DESCENDANT_ACCENT}14`;
        base.opacity = '1';
        break;
      case 'dim':
        base['border-width'] = '1px';
        base['border-color'] = '#e2e8f0';
        base['background-color'] = '#ffffff';
        base.opacity = String(DIM_OPACITY);
        break;
      default:
        base['border-width'] = '1px';
        base['border-color'] = '#cbd5e1';
        base['background-color'] = '#ffffff';
        base.opacity = '1';
    }
    base.color = accent;
    return base;
  };

  const gridStyle = () => {
    const layers = maxLayer() + 1;
    const slots = maxSlot() + 1;
    const cellSize = `minmax(${dims().width}px, auto)`;
    const rowSize = `minmax(${dims().height}px, auto)`;
    if (direction() === 'column') {
      return {
        'grid-template-columns': `repeat(${slots}, ${cellSize})`,
        'grid-template-rows': `repeat(${layers}, ${rowSize})`,
        gap: `${dims().gap}px`,
      };
    }
    return {
      'grid-template-columns': `repeat(${layers}, ${cellSize})`,
      'grid-template-rows': `repeat(${slots}, ${rowSize})`,
      gap: `${dims().gap}px`,
    };
  };

  const nodeGridPosition = (node: ComputeGraphNode) =>
    direction() === 'column'
      ? { 'grid-row': `${node.layer + 1}`, 'grid-column': `${node.slot + 1}` }
      : { 'grid-column': `${node.layer + 1}`, 'grid-row': `${node.slot + 1}` };

  const edgeLines = createMemo<EdgeLine[]>(() => {
    const rects = nodeRects();
    const nodes = nodesById();
    const t = traversal();
    const hovered = hoveredId();
    const lines: EdgeLine[] = [];
    props.spec.edges.forEach((edge, i) => {
      const fromRect = rects.get(edge.from);
      const toRect = rects.get(edge.to);
      const fromNode = nodes.get(edge.from);
      const toNode = nodes.get(edge.to);
      if (!fromRect || !toRect || !fromNode || !toNode) return;

      const fromCenter = { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 };
      const toCenter = { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 };
      const start = boundaryPoint(fromRect, fromNode.style ?? 'box', toCenter);
      const end = boundaryPoint(toRect, toNode.style ?? 'box', fromCenter);

      let stroke = NEUTRAL_EDGE;
      let opacity = 1;
      if (hovered && t) {
        const isAncestorEdge = (edge.to === hovered || t.ancestors.has(edge.to)) && t.ancestors.has(edge.from);
        const isDescendantEdge = (edge.from === hovered || t.descendants.has(edge.from)) && t.descendants.has(edge.to);
        if (isAncestorEdge) {
          stroke = ANCESTOR_ACCENT;
        } else if (isDescendantEdge) {
          stroke = DESCENDANT_ACCENT;
        } else {
          stroke = DIM_EDGE;
          opacity = DIM_OPACITY;
        }
      }

      lines.push({
        key: `${edge.from}->${edge.to}-${i}`,
        edge,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        labelX: (start.x + end.x) / 2,
        labelY: (start.y + end.y) / 2,
        stroke,
        opacity,
      });
    });
    return lines;
  });

  const toggleHover = (id: string) => {
    setHoveredId((cur) => (cur === id ? null : id));
  };

  return (
    <div class="my-2">
      <Show when={props.spec.title}>
        <div class="text-sm font-semibold text-slate-700 mb-1">{props.spec.title}</div>
      </Show>
      <div class={direction() === 'column' ? 'overflow-y-auto max-h-160' : 'overflow-x-auto'}>
        <div ref={containerEl} class="relative inline-block p-4">
          <svg
            class="absolute top-0 left-0 pointer-events-none overflow-visible"
            width={canvasSize().width}
            height={canvasSize().height}
          >
            <defs>
              <marker
                id={markerId}
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
              </marker>
            </defs>
            <For each={edgeLines()}>
              {(line) => (
                <g style={{ opacity: line.opacity }}>
                  <line
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={line.stroke}
                    stroke-width={line.stroke === NEUTRAL_EDGE || line.stroke === DIM_EDGE ? 1.5 : 2.5}
                    marker-end={`url(#${markerId})`}
                  />
                  <Show when={line.edge.label}>
                    {(() => {
                      // Width is tied to the layer gap (not a fixed constant) so the label can
                      // never bleed into the neighboring node boxes on either side, however long
                      // the gap is at the current size — it wraps onto more lines instead.
                      const labelWidth = dims().gap - 8;
                      return (
                        <foreignObject
                          x={line.labelX - labelWidth / 2}
                          y={line.labelY - 18}
                          width={labelWidth}
                          height={36}
                          style={{ overflow: 'visible' }}
                        >
                          <div
                            // @ts-expect-error -- xmlns is valid on a foreignObject child but not in Solid's JSX typings
                            xmlns="http://www.w3.org/1999/xhtml"
                            class="w-full h-full flex items-center justify-center text-center text-[11px] leading-tight px-1 py-0.5 rounded border border-slate-200 bg-white/90 break-words"
                          >
                            <SpecRenderer
                              spec={{ kind: 'markdown', content: `$${line.edge.label}$` } as unknown as RootSpec}
                              apiBase=""
                            />
                          </div>
                        </foreignObject>
                      );
                    })()}
                  </Show>
                </g>
              )}
            </For>
          </svg>
          <div class="grid relative" style={gridStyle()}>
            <For each={props.spec.nodes}>
              {(node) => (
                <div
                  ref={(el) => {
                    nodeRefs.set(node.id, el);
                    onCleanup(() => nodeRefs.delete(node.id));
                  }}
                  class="relative flex flex-col items-center justify-center gap-0.5 border box-border cursor-pointer px-2 py-1 text-center transition-opacity"
                  style={{ ...nodeGridPosition(node), ...nodeBoxStyle(node) }}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => toggleHover(node.id)}
                >
                  <div class="font-semibold leading-tight">{node.label}</div>
                  <Show when={node.formula}>
                    <div class="text-[0.85em] leading-tight">
                      <SpecRenderer
                        spec={{ kind: 'markdown', content: `$$${node.formula}$$` } as unknown as RootSpec}
                        apiBase=""
                      />
                    </div>
                  </Show>
                  <Show when={node.shape}>
                    <div class="text-[0.7em] font-mono text-slate-500 leading-tight">
                      ({node.shape!.join(', ')})
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComputeGraph;
