import { type Component, For, Show, createSignal } from 'solid-js';
import { SpecRenderer } from '@retrofit-ui/spa-solid-shoelace/components';
import type { RootSpec } from '@retrofit-ui/core';
import type { ChalkMatrixSpec } from './spec';
import { PALETTE } from './palette';
import { buildCellNoteLookup, cellNoteKey } from './matrixCellNotes';
import { cellRgb, rgbToCss, textColor } from './colorScale';

const NOTE_ACCENT = PALETTE[0]; // blue, for hover-reveal emphasis on labels/formulas

const DIAGONAL_ACCENT = PALETTE[4]; // orange, for highlightDiagonal borders

const SIZE_MAX_WIDTH: Record<string, number> = { small: 280, medium: 480, large: 720 };

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

  // Hover-reveal formulas (optional, teaching Jacobians): [row, col] of the
  // currently hovered/tapped cell, or null when nothing is revealed.
  const [hovered, setHovered] = createSignal<[number, number] | null>(null);
  const noteLookup = () => buildCellNoteLookup(spec().cellNotes);
  const noteFor = (rowIdx: number, colIdx: number) => noteLookup().get(cellNoteKey(rowIdx, colIdx));
  const hoveredNote = () => {
    const h = hovered();
    return h ? noteFor(h[0], h[1]) : undefined;
  };
  const toggleHover = (rowIdx: number, colIdx: number) => {
    const h = hovered();
    setHovered(h && h[0] === rowIdx && h[1] === colIdx ? null : [rowIdx, colIdx]);
  };
  const rowEmphasized = (rowIdx: number) => hovered()?.[0] === rowIdx;
  const colEmphasized = (colIdx: number) => hovered()?.[1] === colIdx;
  const panelHeader = () => {
    const { outputVar, inputVar } = spec();
    return outputVar && inputVar ? `∂${outputVar} / ∂${inputVar}` : undefined;
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
            {(label, colIdx) => (
              <div
                class="flex items-center justify-center aspect-square font-medium text-xs"
                classList={{
                  'text-slate-500': !colEmphasized(colIdx()),
                  'font-bold': colEmphasized(colIdx()),
                }}
                style={colEmphasized(colIdx()) ? { color: NOTE_ACCENT } : undefined}
              >
                {label}
              </div>
            )}
          </For>
        </Show>
        <For each={values()}>
          {(row, rowIdx) => (
            <>
              <Show when={hasLabels()}>
                <div
                  class="flex items-center justify-center aspect-square font-medium text-xs"
                  classList={{
                    'text-slate-500': !rowEmphasized(rowIdx()),
                    'font-bold': rowEmphasized(rowIdx()),
                  }}
                  style={rowEmphasized(rowIdx()) ? { color: NOTE_ACCENT } : undefined}
                >
                  {(spec().rowLabels ?? row.map((_, i) => String(i)))[rowIdx()]}
                </div>
              </Show>
              <For each={row}>
                {(v, colIdx) => {
                  const note = () => noteFor(rowIdx(), colIdx());
                  return (
                    <div
                      class="relative flex items-center justify-center aspect-square font-mono text-xs tabular-nums rounded-sm"
                      classList={{ 'cursor-pointer': Boolean(note()) }}
                      style={cellStyle(v, rowIdx(), colIdx())}
                      onMouseEnter={() => note() && setHovered([rowIdx(), colIdx()])}
                      onMouseLeave={() => note() && setHovered(null)}
                      onClick={() => note() && toggleHover(rowIdx(), colIdx())}
                    >
                      {v.toFixed(precision())}
                      <Show when={note()}>
                        <span
                          class="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full"
                          style={{ 'background-color': 'currentColor', opacity: 0.6 }}
                        />
                      </Show>
                    </div>
                  );
                }}
              </For>
            </>
          )}
        </For>
      </div>
      <Show when={hoveredNote()}>
        {(note) => (
          <div class="mt-2 py-2 px-3 border border-slate-200 rounded-md bg-slate-50 text-sm">
            <Show when={panelHeader()}>
              <div class="text-xs font-semibold text-slate-500 mb-1">{panelHeader()}</div>
            </Show>
            <SpecRenderer
              spec={{ kind: 'markdown', content: `$$${note().formula}$$` } as unknown as RootSpec}
              apiBase=""
            />
            <Show when={note().note}>
              <div class="text-xs text-slate-500 mt-1">{note().note}</div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
};

export default MatrixHeatmap;
