import { type Component, createMemo, For, Show } from 'solid-js';
import type { ChalkVectorsSpec } from './spec';
import { color, PALETTE } from './palette';
import { resolveVectors } from './resolveSpecs';
import { equalScaleDomains, formatAngle, polarGrid, polarToCartesian, spokeLabelPoint, type V2 } from './coords';

const markerId = (i: number) => `chalk-vec-arrow-${i % PALETTE.length}`;
const BASIS_MARKER_ID = 'chalk-vec-arrow-basis';
const BASIS_COLOR = '#94a3b8';
const POLAR_GRID_COLOR = '#e2e8f0';
const CLIP_ID = 'chalk-vec-clip';

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

const VectorDiagram: Component<{ spec: ChalkVectorsSpec }> = (props) => {
  // Throws a SpecValidationError for a bad spec; ChalkSpecRenderer shows it.
  const resolved = resolveVectors(props.spec);
  const polar = resolved.grid === 'polar';
  // A polar grid needs equal scale on both axes (the drawing box is square), or rings are ellipses.
  const domains = polar
    ? equalScaleDomains(resolved.xDomain, resolved.yDomain, INNER_W, INNER_H)
    : { xDomain: resolved.xDomain, yDomain: resolved.yDomain };
  const xDomain = () => domains.xDomain ?? DEFAULT_DOMAIN;
  const yDomain = () => domains.yDomain ?? DEFAULT_DOMAIN;
  const sx = (x: number) => toSVGX(x, xDomain());
  const sy = (y: number) => toSVGY(y, yDomain());
  const pxPerUnit = INNER_W / (xDomain()[1] - xDomain()[0]);

  const grid = createMemo(() => {
    if (!polar) return null;
    const g = polarGrid(xDomain(), yDomain());
    const inView = Math.min(-xDomain()[0], xDomain()[1], -yDomain()[0], yDomain()[1]);
    const labelR = [...g.rings].reverse().find((r) => r <= inView * 0.9) ?? g.rings[0];
    return { ...g, reach: g.rings[g.rings.length - 1] ?? g.rMax, labelR };
  });

  // Faint integer gridlines only when the domain span stays small enough to avoid clutter.
  const showGridlines = () => {
    const [xLo, xHi] = xDomain();
    const [yLo, yHi] = yDomain();
    return !polar && xHi - xLo <= 20 && yHi - yLo <= 20;
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
    <div data-kind="chalk-vectors" class="my-2" style={{ 'max-width': `${SIZE_MAX_WIDTH[props.spec.size ?? 'medium']}px` }}>
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
          <marker id={BASIS_MARKER_ID} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L7,3.5 L0,7 Z" fill={BASIS_COLOR} />
          </marker>
          <clipPath id={CLIP_ID}>
            <rect x={MARGIN} y={MARGIN} width={INNER_W} height={INNER_H} />
          </clipPath>
        </defs>

        {/* Polar grid: rings, spokes every π/6, and angle labels on the largest ring in view */}
        <Show when={grid()}>
          {(g) => (
            <g data-grid="polar" clip-path={`url(#${CLIP_ID})`}>
              <For each={g().rings}>
                {(r) => (
                  <circle data-polar-ring={r} cx={sx(0)} cy={sy(0)} r={r * pxPerUnit} fill="none" stroke={POLAR_GRID_COLOR} stroke-width="1" />
                )}
              </For>
              <For each={g().spokes}>
                {(theta) => {
                  const [x, y] = polarToCartesian(g().reach, theta);
                  return <line x1={sx(0)} y1={sy(0)} x2={sx(x)} y2={sy(y)} stroke={POLAR_GRID_COLOR} stroke-width="1" />;
                }}
              </For>
              <For each={g().spokes}>
                {(theta) => {
                  const [x, y] =
                    spokeLabelPoint(theta, xDomain(), yDomain(), 12 / pxPerUnit) ?? polarToCartesian(g().labelR * 1.08, theta);
                  return (
                    <text x={sx(x)} y={sy(y)} dy="0.35em" text-anchor="middle" font-size="10" fill="#94a3b8" font-family="ui-sans-serif, system-ui, sans-serif">
                      {formatAngle(theta, resolved.angleUnit)}
                    </text>
                  );
                }}
              </For>
            </g>
          )}
        </Show>

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
        <For each={resolved.arrows}>
          {(v, i) => {
            const c = () => color(v.colorIndex ?? i());
            const pIndex = () => v.colorIndex ?? i();
            const x1 = () => sx(v.start[0]);
            const y1 = () => sy(v.start[1]);
            const x2 = () => sx(v.end[0]);
            const y2 = () => sy(v.end[1]);
            const angle = () => Math.atan2(y2() - y1(), x2() - x1());
            const midX = () => (x1() + x2()) / 2;
            const midY = () => (y1() + y2()) / 2;
            const offsetPx = 12;
            const labelX = () => midX() + -Math.sin(angle()) * offsetPx;
            const labelY = () => midY() + Math.cos(angle()) * offsetPx;

            // Unit r̂ and θ̂ at the tail, drawn one unit long (or 1/4 of the view, if a unit is tiny).
            const basisLen = Math.max(1, 0.25 * (xDomain()[1] - xDomain()[0]) / 2);
            const basisTip = (dir: V2) => [sx(v.start[0] + dir[0] * basisLen), sy(v.start[1] + dir[1] * basisLen)] as const;

            return (
              <g data-vector-id={v.id}>
                <Show when={v.basis}>
                  {(b) => (
                    <For each={[{ dir: b().rHat, label: 'r̂' }, { dir: b().thetaHat, label: 'θ̂' }]}>
                      {(axis) => {
                        const [bx, by] = basisTip(axis.dir);
                        return (
                          <g data-basis={axis.label}>
                            <line x1={x1()} y1={y1()} x2={bx} y2={by} stroke={BASIS_COLOR} stroke-width="1.5" stroke-dasharray="4 3" marker-end={`url(#${BASIS_MARKER_ID})`} />
                            <text x={bx + axis.dir[0] * 10} y={by - axis.dir[1] * 10} dy="0.35em" text-anchor="middle" font-size="12" font-weight="600" fill={BASIS_COLOR} font-family="ui-sans-serif, system-ui, sans-serif" stroke="#fff" stroke-width="4" paint-order="stroke">
                              {axis.label}
                            </text>
                          </g>
                        );
                      }}
                    </For>
                  )}
                </Show>
                <line
                  data-arrow
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
