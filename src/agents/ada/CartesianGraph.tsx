import { type Component, createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import functionPlot from 'function-plot';
import type { ChalkGraphSpec } from './spec';
import styles from './CartesianGraph.module.css';

const FALLBACK_HEIGHT = 300;
const MAX_WIDTH = 640;
const MAX_HEIGHT = 480;

// 16-color light-mode palette — Tailwind 600 level, chosen for contrast on white
const PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#be185d', // pink
  '#65a30d', // lime
  '#7c3aed', // violet
  '#0f766e', // teal
  '#d97706', // amber
  '#4f46e5', // indigo
  '#059669', // emerald
  '#e11d48', // rose
  '#0284c7', // sky
  '#c026d3', // fuchsia
];

const color = (index: number) => PALETTE[index % PALETTE.length];

const round2 = (n: number) => Math.round(n * 100) / 100;

const CartesianGraph: Component<{
  spec: ChalkGraphSpec;
  onGraphClick?: (points: Array<{ x: number; y: number }>) => void;
}> = (props) => {
  let el!: HTMLDivElement;
  let currentWidth = 0;
  const [pendingClicks, setPendingClicks] = createSignal<Array<{ x: number; y: number }>>([]);

  const draw = (w: number) => {
    if (!w) return;
    w = Math.min(w, MAX_WIDTH);
    currentWidth = w;
    const h = Math.min(
      props.spec.xDomain && props.spec.yDomain
        ? w * (props.spec.yDomain[1] - props.spec.yDomain[0]) / (props.spec.xDomain[1] - props.spec.xDomain[0])
        : FALLBACK_HEIGHT,
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
        })),
        ...pointData,
        ...clickMarkers,
      ],
    });

    if (props.spec.interactive && props.onGraphClick) {
      const svgEl = el.querySelector('svg') as SVGSVGElement | null;
      const plotG = svgEl?.querySelector('g') as SVGGElement | null;
      if (svgEl && plotG) {
        svgEl.style.cursor = 'crosshair';
        svgEl.addEventListener('click', (e: MouseEvent) => {
          const ctm = plotG.getScreenCTM();
          if (!ctm) return;
          const pt = svgEl.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const local = pt.matrixTransform(ctm.inverse());
          const x = round2(instance.meta.xScale!.invert(local.x));
          const y = round2(instance.meta.yScale!.invert(local.y));
          setPendingClicks((prev) => [...prev, { x, y }]);
        });
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
    <div class={styles.container}>
      {props.spec.title && <div class={styles.title}>{props.spec.title}</div>}
      <div ref={el} class={styles.plot} />
      <Show when={props.spec.interactive && props.onGraphClick}>
        <div class={styles.interactiveBar}>
          <Show
            when={pendingClicks().length > 0}
            fallback={<span class={styles.interactiveHint}>Click the graph to mark points</span>}
          >
            <span class={styles.clickCount}>
              {pendingClicks().length} point{pendingClicks().length > 1 ? 's' : ''} marked
            </span>
            <button class={styles.clearBtn} onClick={() => setPendingClicks([])}>Clear</button>
            <button class={styles.submitBtn} onClick={submit}>Submit</button>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default CartesianGraph;
