import { type Component, createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import functionPlot from 'function-plot';
import type { ChalkGraphParam, ChalkGraphSpec } from './spec';
import { color } from './palette';
import './CartesianGraph.css';

const FALLBACK_HEIGHT = 300;
const MAX_HEIGHT = 480;
const MIN_HEIGHT = 200;

const SIZE_MAX_WIDTH: Record<string, number> = { small: 320, medium: 640, large: 900 };

const round2 = (n: number) => Math.round(n * 100) / 100;

const CartesianGraph: Component<{
  spec: ChalkGraphSpec;
  onGraphClick?: (points: Array<{ x: number; y: number }>) => void;
}> = (props) => {
  let el!: HTMLDivElement;
  let currentWidth = 0;
  let clickCleanup: (() => void) | null = null;
  const [pendingClicks, setPendingClicks] = createSignal<Array<{ x: number; y: number }>>([]);
  const [paramValues, setParamValues] = createSignal<Record<string, number>>(
    Object.fromEntries((props.spec.params ?? []).map((p) => [p.name, p.default])),
  );

  const draw = (w: number) => {
    if (!w) return;
    // Reading paramValues() here makes this draw() reactive to slider changes
    const scope = paramValues();
    w = Math.min(w, SIZE_MAX_WIDTH[props.spec.size ?? 'medium']);
    currentWidth = w;
    const h = Math.min(
      Math.max(
        props.spec.xDomain && props.spec.yDomain
          ? w * (props.spec.yDomain[1] - props.spec.yDomain[0]) / (props.spec.xDomain[1] - props.spec.xDomain[0])
          : FALLBACK_HEIGHT,
        MIN_HEIGHT,
      ),
      MAX_HEIGHT,
    );

    el.style.height = `${h}px`;

    const curveCount = props.spec.curves.length;
    const pointData = (props.spec.points ?? []).flatMap((p, i) => {
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
      grid: true,
      xAxis: props.spec.xDomain ? { domain: props.spec.xDomain } : undefined,
      yAxis: props.spec.yDomain ? { domain: props.spec.yDomain } : undefined,
      data: [
        ...props.spec.curves.map((c, i) => ({
          fn: c.fn,
          graphType: 'polyline' as const,
          color: color(i),
          scope,
        })),
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
          const x = round2(instance.meta.xScale!.invert(local.x));
          const y = round2(instance.meta.yScale!.invert(local.y));
          setPendingClicks((prev) =>
            prev.some((p) => p.x === x && p.y === y) ? prev : [...prev, { x, y }],
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
    <div class="my-2 max-w-160" style={{ 'max-width': `${SIZE_MAX_WIDTH[props.spec.size ?? 'medium']}px` }}>
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
