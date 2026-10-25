import { type Component, createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import functionPlot from 'function-plot';
import type { ChalkGraphParam, ChalkGraphSpec } from './spec';
import { color } from './palette';
import { resolveGraph } from './resolveSpecs';
import {
  cartesianToPolar,
  equalScaleDomains,
  formatAngle,
  polarGrid,
  polarToCartesian,
  spokeLabelPoint,
  type GraphClickPoint,
  type V2,
} from './coords';
import './CartesianGraph.css';

const FALLBACK_HEIGHT = 300;
const MAX_HEIGHT = 480;
const MIN_HEIGHT = 200;

const SIZE_MAX_WIDTH: Record<string, number> = { small: 320, medium: 640, large: 900 };

const round2 = (n: number) => Math.round(n * 100) / 100;

// function-plot's fixed margins (chart.js); the plot area is what must be equal-scaled.
const MARGIN_X = 40 + 20;
const MARGIN_Y = 20 + 20;

const GRID_COLOR = '#e2e8f0';
// Slate-500, the axis tick colour. Set as an attr: function-plot's own `color` for text is
// drawn brightened by 1.5, and its text is left-anchored, which clips labels on the right.
const GRID_LABEL_ATTR = { fill: '#64748b', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': '0.7rem' };

// function-plot's own parser knows PI but not pi or e, which models write constantly.
const CONSTANTS_SCOPE = { pi: Math.PI, e: Math.E };

/** Rings, spokes and angle labels as function-plot data, so pan/zoom keeps them aligned. */
function polarGridData(xDomain: V2, yDomain: V2, angleUnit: 'radians' | 'degrees', labelInset: number) {
  const { rings, spokes, rMax } = polarGrid(xDomain, yDomain);
  const reach = rings[rings.length - 1] ?? rMax;
  // Angle labels ring the border of the view; if the origin is out of view, they sit on the
  // largest ring that is fully in view instead.
  const inView = Math.min(-xDomain[0], xDomain[1], -yDomain[0], yDomain[1]);
  const labelR = [...rings].reverse().find((r) => r <= inView * 0.92) ?? rings[0];
  return [
    ...rings.map((r) => ({
      fnType: 'polar' as const,
      r: String(r),
      range: [0, 2 * Math.PI] as [number, number],
      graphType: 'polyline' as const,
      color: GRID_COLOR,
      skipTip: true,
      attr: { 'data-polar-ring': String(r) },
    })),
    ...spokes.map((theta) => ({
      fnType: 'points' as const,
      points: [[0, 0], polarToCartesian(reach, theta)],
      graphType: 'polyline' as const,
      color: GRID_COLOR,
      skipTip: true,
    })),
    ...(labelR === undefined
      ? []
      : spokes.map((theta) => ({
          fnType: 'text' as const,
          graphType: 'text' as const,
          location: spokeLabelPoint(theta, xDomain, yDomain, labelInset) ?? polarToCartesian(labelR * 1.06, theta),
          text: formatAngle(theta, angleUnit),
          attr: GRID_LABEL_ATTR,
        }))),
  ];
}

const CartesianGraph: Component<{
  spec: ChalkGraphSpec;
  onGraphClick?: (points: GraphClickPoint[]) => void;
}> = (props) => {
  // Throws a SpecValidationError for a bad spec; ChalkSpecRenderer shows it.
  const resolved = resolveGraph(props.spec);
  const polar = resolved.grid === 'polar';
  let el!: HTMLDivElement;
  let currentWidth = 0;
  let clickCleanup: (() => void) | null = null;
  const [pendingClicks, setPendingClicks] = createSignal<GraphClickPoint[]>([]);
  const [paramValues, setParamValues] = createSignal<Record<string, number>>(
    Object.fromEntries((props.spec.params ?? []).map((p) => [p.name, p.default])),
  );

  const draw = (w: number) => {
    if (!w) return;
    // Reading paramValues() here makes this draw() reactive to slider changes
    const scope = paramValues();
    w = Math.min(w, SIZE_MAX_WIDTH[props.spec.size ?? 'medium']);
    currentWidth = w;
    let { xDomain, yDomain } = resolved;
    const h = Math.min(
      Math.max(
        xDomain && yDomain
          ? w * (yDomain[1] - yDomain[0]) / (xDomain[1] - xDomain[0])
          : FALLBACK_HEIGHT,
        MIN_HEIGHT,
      ),
      MAX_HEIGHT,
    );

    el.style.height = `${h}px`;

    // A polar grid needs one unit to cover the same pixels on both axes, or its rings are
    // ellipses; the height clamp above would otherwise break that.
    if (polar && xDomain && yDomain) {
      ({ xDomain, yDomain } = equalScaleDomains(xDomain, yDomain, w - MARGIN_X, h - MARGIN_Y));
    }

    const curveCount = resolved.curves.length;
    const pointData = resolved.points.flatMap((p, i) => {
      const c = color(curveCount + i);
      return [
        { fnType: 'points' as const, points: [[p.x, p.y]], graphType: 'scatter' as const, color: c },
        { fnType: 'text' as const, graphType: 'text' as const, location: [p.x, p.y] as [number, number], text: p.label, color: c },
      ];
    });

    // Reading pendingClicks() here makes this draw() reactive to click accumulation
    const clickMarkers = pendingClicks().flatMap(({ x, y }) => [
      { fnType: 'points' as const, points: [[x, y]], graphType: 'scatter' as const, color: '#f59e0b' },
    ]);

    const instance = functionPlot({
      target: el,
      width: w,
      height: h,
      grid: !polar,
      xAxis: xDomain ? { domain: xDomain } : undefined,
      yAxis: yDomain ? { domain: yDomain } : undefined,
      data: [
        ...(polar && xDomain && yDomain
          ? polarGridData(xDomain, yDomain, resolved.angleUnit, (14 * (xDomain[1] - xDomain[0])) / (w - MARGIN_X))
          : []),
        ...resolved.curves.map((c, i) =>
          c.coords === 'polar'
            ? {
                fnType: 'polar' as const,
                r: c.r,
                range: c.range,
                graphType: 'polyline' as const,
                color: color(i),
                scope: { ...CONSTANTS_SCOPE, ...scope },
              }
            : {
                fn: c.fn,
                graphType: 'polyline' as const,
                color: color(i),
                scope: { ...CONSTANTS_SCOPE, ...scope },
              },
        ),
        ...pointData,
        ...clickMarkers,
      ],
    });

    clickCleanup?.();
    clickCleanup = null;

    if (props.spec.interactive && props.onGraphClick) {
      const svgEl = el.querySelector('svg') as SVGSVGElement | null;
      const plotG = svgEl?.querySelector('g') as SVGGElement | null;
      if (svgEl && plotG) {
        svgEl.style.cursor = 'crosshair';
        const handler = (e: MouseEvent) => {
          const ctm = plotG.getScreenCTM();
          if (!ctm) return;
          const pt = svgEl.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const local = pt.matrixTransform(ctm.inverse());
          const rawX = instance.meta.xScale!.invert(local.x);
          const rawY = instance.meta.yScale!.invert(local.y);
          const x = round2(rawX);
          const y = round2(rawY);
          const { r, theta } = cartesianToPolar(rawX, rawY);
          const point: GraphClickPoint = polar
            ? { x, y, polar: { r: round2(r), theta, angleUnit: resolved.angleUnit } }
            : { x, y };
          setPendingClicks((prev) =>
            prev.some((p) => p.x === x && p.y === y) ? prev : [...prev, point],
          );
        };
        svgEl.addEventListener('click', handler);
        clickCleanup = () => svgEl.removeEventListener('click', handler);
      }
    }
  };

  onMount(() => {
    draw(el.offsetWidth);
    const ro = new ResizeObserver((entries) => {
      draw(Math.round(entries[0].contentRect.width));
    });
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  createEffect(() => { draw(currentWidth || el.offsetWidth); });

  onCleanup(() => { el.replaceChildren(); });

  const submit = () => {
    const pts = pendingClicks();
    if (!pts.length) return;
    props.onGraphClick!(pts);
    setPendingClicks([]);
  };

  return (
    <div data-kind="chalk-graph" class="my-2 max-w-160" style={{ 'max-width': `${SIZE_MAX_WIDTH[props.spec.size ?? 'medium']}px` }}>
      {props.spec.title && <div class="text-sm font-semibold text-slate-700 mb-1">{props.spec.title}</div>}
      <div ref={el} class="chalk-plot w-full" />
      <Show when={props.spec.interactive && props.onGraphClick}>
        <div class="flex items-center gap-2 mt-1.5 min-h-7">
          <Show
            when={pendingClicks().length > 0}
            fallback={<span class="text-xs text-slate-400 italic">Click the graph to mark points</span>}
          >
            <span class="text-xs text-slate-500 font-mono">
              {pendingClicks().length} point{pendingClicks().length > 1 ? 's' : ''} marked
            </span>
            <button
              class="text-xs py-0.5 px-2 border border-slate-300 rounded bg-slate-50 text-slate-500 cursor-pointer hover:bg-slate-100"
              onClick={() => setPendingClicks([])}
            >
              Clear
            </button>
            <button
              class="text-xs py-0.5 px-2.5 border-none rounded bg-blue-600 text-white cursor-pointer font-medium hover:bg-blue-700"
              onClick={submit}
            >
              Submit
            </button>
          </Show>
        </div>
      </Show>
      <Show when={props.spec.params && props.spec.params.length > 0}>
        <div class="flex flex-col gap-1.5 mt-2">
          <For each={props.spec.params}>
            {(p: ChalkGraphParam) => (
              <div class="flex items-center gap-2 text-xs text-slate-600">
                <label class="font-mono min-w-16">{p.label ?? p.name} = {paramValues()[p.name].toFixed(2)}</label>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step ?? (p.max - p.min) / 100}
                  value={paramValues()[p.name]}
                  class="flex-1 accent-blue-600"
                  onInput={(e) => setParamValues((prev) => ({ ...prev, [p.name]: Number(e.currentTarget.value) }))}
                />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default CartesianGraph;
