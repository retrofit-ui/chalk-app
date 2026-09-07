import { type Component, createMemo, For, Show } from 'solid-js';
import type { ChalkVector2D, ChalkVectorsSpec } from './spec';
import { color, PALETTE } from './palette';

const markerId = (i: number) => `chalk-vec-arrow-${i % PALETTE.length}`;

// ViewBox: 400 × 400. Inner drawing area: 360 × 360 with 20px margin.
const MARGIN = 20;
const INNER_W = 360;
const INNER_H = 360;

const SIZE_MAX_WIDTH: Record<string, number> = { small: 280, medium: 400, large: 560 };

const DEFAULT_DOMAIN: [number, number] = [-5, 5];

const toSVGX = (x: number, xDomain: [number, number]) =>
  MARGIN + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * INNER_W;

const toSVGY = (y: number, yDomain: [number, number]) =>
  MARGIN + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * INNER_H;

type Point = { x: number; y: number };
type ComposedVector = { start: Point; end: Point };

const VectorDiagram: Component<{ spec: ChalkVectorsSpec }> = (props) => {
  const xDomain = () => props.spec.xDomain ?? DEFAULT_DOMAIN;
  const yDomain = () => props.spec.yDomain ?? DEFAULT_DOMAIN;

  const composed = createMemo<ComposedVector[]>(() => {
    const mode = props.spec.compose ?? 'origin';
    let cx = 0;
    let cy = 0;
    return props.spec.vectors.map((v) => {
      if (mode === 'head-to-tail') {
        const start = { x: cx, y: cy };
        const end = { x: cx + v.x, y: cy + v.y };
        cx = end.x;
        cy = end.y;
        return { start, end };
      }
      return { start: { x: 0, y: 0 }, end: { x: v.x, y: v.y } };
    });
  });

  // Faint integer gridlines only when the domain span stays small enough to avoid clutter.
  const showGridlines = () => {
    const [xLo, xHi] = xDomain();
    const [yLo, yHi] = yDomain();
    return xHi - xLo <= 20 && yHi - yLo <= 20;
  };

  const gridXs = createMemo(() => {
    if (!showGridlines()) return [];
    const [lo, hi] = xDomain();
    const start = Math.ceil(lo);
    const end = Math.floor(hi);
    const xs: number[] = [];
    for (let x = start; x <= end; x++) xs.push(x);
    return xs;
  });

  const gridYs = createMemo(() => {
    if (!showGridlines()) return [];
    const [lo, hi] = yDomain();
    const start = Math.ceil(lo);
    const end = Math.floor(hi);
    const ys: number[] = [];
    for (let y = start; y <= end; y++) ys.push(y);
    return ys;
  });

  return (
    <div class="my-2" style={{ 'max-width': `${SIZE_MAX_WIDTH[props.spec.size ?? 'medium']}px` }}>
      <Show when={props.spec.title}>
        <div class="text-sm font-semibold text-slate-700 mb-1">{props.spec.title}</div>
      </Show>
      <svg
        class="block w-full rounded-md bg-white"
        viewBox="0 0 400 400"
        width="100%"
        height="auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* One arrowhead marker per palette color, defined once and reused across all vectors. */}
          <For each={PALETTE}>
            {(c, i) => (
              <marker
                id={markerId(i())}
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0,0 L8,4 L0,8 Z" fill={c} />
              </marker>
            )}
          </For>
        </defs>

        {/* Faint integer gridlines */}
        <Show when={showGridlines()}>
          <For each={gridXs()}>
            {(x) => (
              <line
                x1={toSVGX(x, xDomain())} y1={MARGIN}
                x2={toSVGX(x, xDomain())} y2={MARGIN + INNER_H}
                stroke="#f1f5f9"
                stroke-width="1"
              />
            )}
          </For>
          <For each={gridYs()}>
            {(y) => (
              <line
                x1={MARGIN} y1={toSVGY(y, yDomain())}
                x2={MARGIN + INNER_W} y2={toSVGY(y, yDomain())}
                stroke="#f1f5f9"
                stroke-width="1"
              />
            )}
          </For>
        </Show>

        {/* Axis lines through the origin */}
        <line
          x1={toSVGX(0, xDomain())} y1={MARGIN}
          x2={toSVGX(0, xDomain())} y2={MARGIN + INNER_H}
          stroke="#cbd5e1"
          stroke-width="1.5"
        />
        <line
          x1={MARGIN} y1={toSVGY(0, yDomain())}
          x2={MARGIN + INNER_W} y2={toSVGY(0, yDomain())}
          stroke="#cbd5e1"
          stroke-width="1.5"
        />

        {/* Vectors — drawn with plain clean lines/arrowheads (no sketchy filter): a student
            needs to visually confirm e.g. that ŷ + e lands exactly on y, so precision matters
            more than the hand-sketched aesthetic used elsewhere in the app. */}
        <For each={props.spec.vectors}>
          {(v, i) => {
            const c = () => color(v.colorIndex ?? i());
            const pIndex = () => v.colorIndex ?? i();
            const start = () => composed()[i()].start;
            const end = () => composed()[i()].end;
            const x1 = () => toSVGX(start().x, xDomain());
            const y1 = () => toSVGY(start().y, yDomain());
            const x2 = () => toSVGX(end().x, xDomain());
            const y2 = () => toSVGY(end().y, yDomain());
            const angle = () => Math.atan2(y2() - y1(), x2() - x1());
            const midX = () => (x1() + x2()) / 2;
            const midY = () => (y1() + y2()) / 2;
            const offsetPx = 12;
            const labelX = () => midX() + -Math.sin(angle()) * offsetPx;
            const labelY = () => midY() + Math.cos(angle()) * offsetPx;

            return (
              <g>
                <line
                  x1={x1()} y1={y1()}
                  x2={x2()} y2={y2()}
                  stroke={c()}
                  stroke-width="2.5"
                  marker-end={`url(#${markerId(pIndex())})`}
                />
                <Show when={v.label}>
                  <text
                    x={labelX()}
                    y={labelY()}
                    text-anchor="middle"
                    font-size="13"
                    font-weight="600"
                    font-family="ui-sans-serif, system-ui, sans-serif"
                    fill={c()}
                    pointer-events="none"
                  >
                    {v.label}
                  </text>
                </Show>
              </g>
            );
          }}
        </For>
      </svg>
    </div>
  );
};

export default VectorDiagram;
