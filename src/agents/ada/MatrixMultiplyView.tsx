import { type Component, For, Show, createMemo, createSignal } from 'solid-js';
import type { ChalkMatmulSpec } from './spec';
import { PALETTE } from './palette';
import { multiplyMatrices } from './matmul';

// Individual-grid sizing, deliberately smaller than MatrixHeatmap's SIZE_MAX_WIDTH since
// three grids (A, B, Result) sit side by side here rather than one grid alone.
const SIZE_MAX_WIDTH: Record<string, number> = { small: 160, medium: 220, large: 300 };
const CELL_PX = 48;

const ROW_ACCENT = PALETTE[0]; // blue, highlights the contributing row of A
const COL_ACCENT = PALETTE[1]; // red, highlights the contributing column of B
const ACTIVE_BORDER = '#1e293b'; // slate-800, neutral strong border for the active result cell

// Appends a hex alpha suffix (e.g. "22" ~ 13%) to a "#rrggbb" color for a translucent fill.
const withAlpha = (hex: string, alpha: string) => `${hex}${alpha}`;

type CellStyle = (row: number, col: number) => Record<string, string> | undefined;

type MatrixGridProps = {
  values: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  precision: number;
  size: 'small' | 'medium' | 'large';
  cellStyle?: CellStyle;
  interactive?: {
    onEnter: (row: number, col: number) => void;
    onLeave: () => void;
    onClick: (row: number, col: number) => void;
  };
};

// Plain (non-heatmap) matrix grid: cells stay white/slate rather than colored by magnitude,
// so the row/column highlight overlay (applied via cellStyle) is what draws the eye — a
// deliberate divergence from MatrixHeatmap's value-based color scale.
const MatrixGrid: Component<MatrixGridProps> = (props) => {
  const cols = () => props.values[0]?.length ?? 0;
  const hasLabels = () => Boolean(props.rowLabels || props.colLabels);
  const gridCols = () => cols() + (hasLabels() ? 1 : 0);
  const maxWidth = () => Math.min(gridCols() * CELL_PX, SIZE_MAX_WIDTH[props.size]);

  return (
    <div
      class="grid"
      style={{
        'grid-template-columns': `repeat(${gridCols()}, 1fr)`,
        gap: '2px',
        'max-width': `${maxWidth()}px`,
      }}
    >
      <Show when={hasLabels()}>
        <div />
        <For each={props.colLabels ?? props.values[0]?.map((_, i) => String(i))}>
          {(label) => (
            <div class="flex items-center justify-center aspect-square font-medium text-xs text-slate-500">
              {label}
            </div>
          )}
        </For>
      </Show>
      <For each={props.values}>
        {(row, rowIdx) => (
          <>
            <Show when={hasLabels()}>
              <div class="flex items-center justify-center aspect-square font-medium text-xs text-slate-500">
                {(props.rowLabels ?? row.map((_, i) => String(i)))[rowIdx()]}
              </div>
            </Show>
            <For each={row}>
              {(v, colIdx) => (
                <div
                  class="flex items-center justify-center aspect-square font-mono text-xs tabular-nums rounded-sm bg-white border border-slate-200"
                  classList={{ 'cursor-pointer': Boolean(props.interactive) }}
                  style={props.cellStyle?.(rowIdx(), colIdx())}
                  onMouseEnter={() => props.interactive?.onEnter(rowIdx(), colIdx())}
                  onMouseLeave={() => props.interactive?.onLeave()}
                  onClick={() => props.interactive?.onClick(rowIdx(), colIdx())}
                >
                  {v.toFixed(props.precision)}
                </div>
              )}
            </For>
          </>
        )}
      </For>
    </div>
  );
};

const MatrixMultiplyView: Component<{ spec: ChalkMatmulSpec }> = (props) => {
  const spec = () => props.spec;
  const precision = () => spec().precision ?? 2;
  const size = () => spec().size ?? 'medium';

  // Computed client-side from raw a/b, never trusted from the spec — see matmul.ts.
  const matmul = createMemo(() => multiplyMatrices(spec().a, spec().b));
  const resultC = () => {
    const m = matmul();
    return m.ok ? m.c : null;
  };
  const errorMessage = () => {
    const m = matmul();
    return m.ok ? null : m.error;
  };

  // Active result cell (i, j) being hovered or tapped, or null when nothing is active.
  const [active, setActive] = createSignal<[number, number] | null>(null);
  const toggleActive = (i: number, j: number) => {
    const cur = active();
    setActive(cur && cur[0] === i && cur[1] === j ? null : [i, j]);
  };

  const rowStyleA: CellStyle = (rowIdx) => {
    const act = active();
    if (!act || act[0] !== rowIdx) return undefined;
    return { 'background-color': withAlpha(ROW_ACCENT, '22'), 'border-color': ROW_ACCENT };
  };

  const colStyleB: CellStyle = (_rowIdx, colIdx) => {
    const act = active();
    if (!act || act[1] !== colIdx) return undefined;
    return { 'background-color': withAlpha(COL_ACCENT, '22'), 'border-color': COL_ACCENT };
  };

  const resultStyle: CellStyle = (rowIdx, colIdx) => {
    const act = active();
    if (!act || act[0] !== rowIdx || act[1] !== colIdx) return undefined;
    return { border: `2px solid ${ACTIVE_BORDER}`, 'background-color': '#f8fafc' };
  };

  // Dot-product arithmetic text, e.g. "2×1 + 3×4 = 14" — built from the literal a[i] row
  // and b[:,j] column values plus the already-computed result, never a hardcoded string.
  const arithmetic = createMemo(() => {
    const act = active();
    const c = resultC();
    if (!act || !c) return null;
    const [i, j] = act;
    const row = spec().a[i];
    const col = spec().b.map((bRow) => bRow[j]);
    const terms = row.map((v, k) => `${v.toFixed(precision())}×${col[k].toFixed(precision())}`);
    return `${terms.join(' + ')} = ${c[i][j].toFixed(precision())}`;
  });

  return (
    <div data-kind="chalk-matmul" class="my-2">
      <Show when={spec().title}>
        <div class="text-sm font-semibold text-slate-700 mb-1">{spec().title}</div>
      </Show>
      <Show
        when={resultC()}
        fallback={
          <div class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md py-2 px-3">
            {errorMessage()}
          </div>
        }
      >
        {(c) => (
          <>
            <div class="flex items-end gap-2 overflow-x-auto pb-1">
              <div class="flex flex-col gap-1 items-center">
                <Show when={spec().aLabel}>
                  <div class="text-xs font-semibold text-slate-600">{spec().aLabel}</div>
                </Show>
                <MatrixGrid
                  values={spec().a}
                  rowLabels={spec().rowLabelsA}
                  colLabels={spec().colLabelsA}
                  precision={precision()}
                  size={size()}
                  cellStyle={rowStyleA}
                />
              </div>
              <div class="text-lg text-slate-400 font-semibold pb-3">×</div>
              <div class="flex flex-col gap-1 items-center">
                <Show when={spec().bLabel}>
                  <div class="text-xs font-semibold text-slate-600">{spec().bLabel}</div>
                </Show>
                <MatrixGrid
                  values={spec().b}
                  rowLabels={spec().rowLabelsB}
                  colLabels={spec().colLabelsB}
                  precision={precision()}
                  size={size()}
                  cellStyle={colStyleB}
                />
              </div>
              <div class="text-lg text-slate-400 font-semibold pb-3">=</div>
              <div class="flex flex-col gap-1 items-center">
                <MatrixGrid
                  values={c()}
                  precision={precision()}
                  size={size()}
                  cellStyle={resultStyle}
                  interactive={{
                    onEnter: (i, j) => setActive([i, j]),
                    onLeave: () => setActive(null),
                    onClick: (i, j) => toggleActive(i, j),
                  }}
                />
              </div>
            </div>
            <Show when={arithmetic()}>
              <div class="mt-2 py-2 px-3 border border-slate-200 rounded-md bg-slate-50 text-sm font-mono tabular-nums">
                {arithmetic()}
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
};

export default MatrixMultiplyView;
