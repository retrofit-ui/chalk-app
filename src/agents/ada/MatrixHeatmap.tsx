import { type Component, For, Show } from 'solid-js';
import type { ChalkMatrixSpec } from './spec';
import { PALETTE } from './palette';

const DIAGONAL_ACCENT = PALETTE[4]; // orange, for highlightDiagonal borders

const SIZE_MAX_WIDTH: Record<string, number> = { small: 280, medium: 480, large: 720 };

type RGB = [number, number, number];

const WHITE: RGB = [255, 255, 255];
const DIVERGING_NEG: RGB = [37, 99, 235]; // #2563eb, matches PALETTE blue
const DIVERGING_POS: RGB = [220, 38, 38]; // #dc2626, matches PALETTE red

const minMax = (values: number[][]): { min: number; max: number } => {
  let min = Infinity;
  let max = -Infinity;
  for (const row of values) {
    for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min)) { min = 0; max = 0; }
  return { min, max };
};

const interpolateColor = (c1: RGB, c2: RGB, t: number): RGB => {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * clamped),
    Math.round(c1[1] + (c2[1] - c1[1]) * clamped),
    Math.round(c1[2] + (c2[2] - c1[2]) * clamped),
  ];
};

const rgbToCss = (rgb: RGB): string => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

// Sequential scale: fixed hue ~217 (blue), sat ~70%, lightness 97% (low) -> 35% (high).
const hslToRgb = (h: number, s: number, l: number): RGB => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};

const luminance = (rgb: RGB): number => 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];

const textColor = (rgb: RGB): string => (luminance(rgb) < 140 ? '#ffffff' : '#1e293b');

const cellRgb = (
  v: number,
  min: number,
  max: number,
  scale: 'sequential' | 'diverging',
): RGB => {
  if (scale === 'diverging') {
    // Normalize by max absolute magnitude (not min/max range) so that v=0 always
    // maps to true white, regardless of how skewed min/max are — this keeps
    // e.g. off-diagonal entries visually stable when comparing X^T X to X^T X + λI,
    // where only the diagonal shifts.
    const maxAbs = Math.max(Math.abs(min), Math.abs(max));
    if (maxAbs === 0) return WHITE;
    const t = v / maxAbs;
    return t < 0
      ? interpolateColor(WHITE, DIVERGING_NEG, -t)
      : interpolateColor(WHITE, DIVERGING_POS, t);
  }
  if (min === max) return hslToRgb(217, 70, (97 + 35) / 2);
  const t = (v - min) / (max - min);
  const lightness = 97 + (35 - 97) * Math.max(0, Math.min(1, t));
  return hslToRgb(217, 70, lightness);
};

const MatrixHeatmap: Component<{ spec: ChalkMatrixSpec }> = (props) => {
  const spec = () => props.spec;
  const values = () => spec().values;
  const cols = () => values()[0]?.length ?? 0;
  const hasLabels = () => Boolean(spec().rowLabels || spec().colLabels);
  const precision = () => spec().precision ?? 2;
  const scale = () => {
    if (spec().colorScale) return spec().colorScale!;
    const { min, max } = minMax(values());
    return min < 0 && max > 0 ? 'diverging' : 'sequential';
  };
  const gridCols = () => cols() + (hasLabels() ? 1 : 0);
  const maxWidth = () => Math.min(gridCols() * 64, SIZE_MAX_WIDTH[spec().size ?? 'medium']);

  const cellStyle = (v: number, rowIdx: number, colIdx: number) => {
    const { min, max } = minMax(values());
    const rgb = cellRgb(v, min, max, scale());
    const style: Record<string, string> = {
      'background-color': rgbToCss(rgb),
      color: textColor(rgb),
    };
    if (spec().highlightDiagonal && rowIdx === colIdx) {
      style.border = `2px solid ${DIAGONAL_ACCENT}`;
    }
    return style;
  };

  return (
    <div class="my-2" style={{ 'max-width': `${maxWidth()}px` }}>
      <Show when={spec().title}>
        <div class="text-sm font-semibold text-slate-700 mb-1">{spec().title}</div>
      </Show>
      <div
        class="grid"
        style={{ 'grid-template-columns': `repeat(${gridCols()}, 1fr)`, gap: '2px' }}
      >
        <Show when={hasLabels()}>
          <div />
          <For each={spec().colLabels ?? values()[0]?.map((_, i) => String(i))}>
            {(label) => (
              <div class="flex items-center justify-center aspect-square text-slate-500 font-medium text-xs">
                {label}
              </div>
            )}
          </For>
        </Show>
        <For each={values()}>
          {(row, rowIdx) => (
            <>
              <Show when={hasLabels()}>
                <div class="flex items-center justify-center aspect-square text-slate-500 font-medium text-xs">
                  {(spec().rowLabels ?? row.map((_, i) => String(i)))[rowIdx()]}
                </div>
              </Show>
              <For each={row}>
                {(v, colIdx) => (
                  <div
                    class="flex items-center justify-center aspect-square font-mono text-xs tabular-nums rounded-sm"
                    style={cellStyle(v, rowIdx(), colIdx())}
                  >
                    {v.toFixed(precision())}
                  </div>
                )}
              </For>
            </>
          )}
        </For>
      </div>
    </div>
  );
};

export default MatrixHeatmap;
