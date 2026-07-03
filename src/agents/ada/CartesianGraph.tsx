import { type Component, createEffect, onCleanup, onMount } from 'solid-js';
import functionPlot from 'function-plot';
import type { ChalkGraphSpec } from './spec';
import styles from './CartesianGraph.module.css';

const FALLBACK_HEIGHT = 300;

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

const CartesianGraph: Component<{ spec: ChalkGraphSpec }> = (props) => {
  let el!: HTMLDivElement;

  // Captured so createEffect (spec changes) can redraw at the current size
  // without needing to re-measure — ResizeObserver owns measurement.
  let currentWidth = 0;

  const draw = (w: number) => {
    if (!w) return;
    currentWidth = w;
    const h = props.spec.xDomain && props.spec.yDomain
      ? w * (props.spec.yDomain[1] - props.spec.yDomain[0]) / (props.spec.xDomain[1] - props.spec.xDomain[0])
      : FALLBACK_HEIGHT;

    el.style.height = `${h}px`;

    const curveCount = props.spec.curves.length;
    const pointData = (props.spec.points ?? []).flatMap((p, i) => {
      const c = color(curveCount + i);
      return [
        { fnType: 'points' as const, points: [[p.x, p.y]], graphType: 'scatter' as const, color: c },
        { fnType: 'text' as const, graphType: 'text' as const, location: [p.x, p.y] as [number, number], text: p.label, color: c },
      ];
    });

    functionPlot({
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
      ],
    });
  };

  onMount(() => {
    draw(el.offsetWidth);
    const ro = new ResizeObserver((entries) => {
      draw(Math.round(entries[0].contentRect.width));
    });
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  // Re-draw when the spec changes (e.g. streaming update), using last known width.
  createEffect(() => { draw(currentWidth || el.offsetWidth); });

  onCleanup(() => { el.replaceChildren(); });

  return (
    <div class={styles.container}>
      {props.spec.title && <div class={styles.title}>{props.spec.title}</div>}
      <div ref={el} class={styles.plot} />
    </div>
  );
};

export default CartesianGraph;
