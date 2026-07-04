import { type Component, createSignal, For, Show } from 'solid-js';
import type { ChalkSetsSpec } from './spec';
import styles from './SetsRenderer.module.css';

const PALETTE = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea',
  '#ea580c', '#0891b2', '#be185d', '#65a30d',
  '#7c3aed', '#0f766e', '#d97706', '#4f46e5',
  '#059669', '#e11d48', '#0284c7', '#c026d3',
];

const color = (i: number) => PALETTE[i % PALETTE.length];

// ViewBox: 560 × 380. Inner drawing area: 540 × 360 with 10px margin.
const MARGIN = 10;
const INNER_W = 540;
const INNER_H = 360;

const toSVGX = (nx: number) => nx * INNER_W + MARGIN;
const toSVGY = (ny: number) => ny * INNER_H + MARGIN;

const SIZE_MAX_WIDTH: Record<string, number> = { small: 320, medium: 560, large: 900 };

let _nextId = 0;

const SetsRenderer: Component<{
  spec: ChalkSetsSpec;
  // onSetClick?: (id: string) => void  — future hook for interactive set clicking
}> = (props) => {
  const filterId = `sk-${_nextId++}`;
  const lineFilterId = `sk-line-${_nextId++}`;
  const [hoveredId, setHoveredId] = createSignal<string | null>(null);

  return (
    <div class={styles.container} style={{ 'max-width': `${SIZE_MAX_WIDTH[props.spec.size ?? 'medium']}px` }}>
      <Show when={props.spec.title}>
        <div class={styles.title}>{props.spec.title}</div>
      </Show>
      <svg
        class={styles.svg}
        viewBox="0 0 560 380"
        width="100%"
        height="auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id={filterId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id={lineFilterId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        {/* Universe bounding rectangle */}
        <rect
          x={MARGIN} y={MARGIN}
          width={INNER_W} height={INNER_H}
          fill="white"
          stroke="#94a3b8"
          stroke-width="2"
          filter={`url(#${filterId})`}
        />
        <Show when={props.spec.universe}>
          <text
            x={MARGIN + 8}
            y={MARGIN + 18}
            font-size="14"
            font-family="ui-sans-serif, system-ui, sans-serif"
            fill="#94a3b8"
            pointer-events="none"
          >
            {props.spec.universe}
          </text>
        </Show>

        {/* Partition lines */}
        <For each={props.spec.partitions ?? []}>
          {(p) => {
            const x1 = p.x !== undefined ? toSVGX(p.x) : MARGIN;
            const y1 = p.y !== undefined ? toSVGY(p.y) : MARGIN;
            const x2 = p.x !== undefined ? toSVGX(p.x) : MARGIN + INNER_W;
            const y2 = p.y !== undefined ? toSVGY(p.y) : MARGIN + INNER_H;
            return (
              <>
                <line
                  x1={x1} y1={p.x !== undefined ? MARGIN : y1}
                  x2={x2} y2={p.x !== undefined ? MARGIN + INNER_H : y2}
                  stroke="#64748b"
                  stroke-width="1.5"
                  filter={`url(#${lineFilterId})`}
                />
                <Show when={p.label}>
                  <text
                    x={p.x !== undefined ? toSVGX(p.x) + 5 : toSVGX(0.5)}
                    y={p.x !== undefined ? MARGIN + 16 : toSVGY(p.y!) - 5}
                    font-size="12"
                    font-family="ui-sans-serif, system-ui, sans-serif"
                    fill="#64748b"
                    pointer-events="none"
                  >
                    {p.label}
                  </text>
                </Show>
              </>
            );
          }}
        </For>

        {/* Sets (ellipses) */}
        <For each={props.spec.sets}>
          {(s, i) => {
            const c = color(s.colorIndex ?? i());
            const isHovered = () => hoveredId() === s.id;
            return (
              <g
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
                class={styles.setShape}
              >
                <ellipse
                  cx={toSVGX(s.cx)}
                  cy={toSVGY(s.cy)}
                  rx={s.rx * INNER_W}
                  ry={s.ry * INNER_H}
                  fill={c}
                  fill-opacity={isHovered() ? 0.45 : (s.fillOpacity ?? 0.18)}
                  stroke={c}
                  stroke-width="2"
                  filter={`url(#${filterId})`}
                />
                <Show when={s.label}>
                  <text
                    x={toSVGX(s.cx)}
                    y={toSVGY(s.cy) + 5}
                    text-anchor="middle"
                    font-size="15"
                    font-weight="600"
                    font-family="ui-sans-serif, system-ui, sans-serif"
                    fill={c}
                    pointer-events="none"
                  >
                    {s.label}
                  </text>
                </Show>
              </g>
            );
          }}
        </For>

        {/* Text annotations */}
        <For each={props.spec.annotations ?? []}>
          {(a) => (
            <text
              x={toSVGX(a.x)}
              y={toSVGY(a.y)}
              text-anchor={a.align === 'left' ? 'start' : a.align === 'right' ? 'end' : 'middle'}
              font-size="13"
              font-family="ui-sans-serif, system-ui, sans-serif"
              fill="#1e293b"
              pointer-events="none"
            >
              {a.text}
            </text>
          )}
        </For>
      </svg>
    </div>
  );
};

export default SetsRenderer;
