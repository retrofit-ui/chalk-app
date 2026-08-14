import { type Component, For, Match, Show, Switch } from 'solid-js';
import { SpecRenderer } from '@retrofit-ui/spa-solid-shoelace/components';
import type { RootSpec } from '@retrofit-ui/core';
import type { ChalkViewSpec, ChalkGraphSpec, ChalkDrawSpec, ChalkSetsSpec } from './spec';
import CartesianGraph from './CartesianGraph';
import DrawCanvas from './DrawCanvas';
import SetsRenderer from './SetsRenderer';

type ViewNodeProps = {
  spec: { kind: string } & Record<string, unknown>;
  onGraphClick?: (points: Array<{ x: number; y: number }>) => void;
  onDrawSubmit?: (imageBase64: string) => void;
};

const ViewNode: Component<ViewNodeProps> = (props) => {
  return (
    <Switch>
      <Match when={props.spec.kind === 'chalk-graph'}>
        <CartesianGraph spec={props.spec as unknown as ChalkGraphSpec} onGraphClick={props.onGraphClick} />
      </Match>
      <Match when={props.spec.kind === 'chalk-draw'}>
        <DrawCanvas spec={props.spec as unknown as ChalkDrawSpec} onSubmit={props.onDrawSubmit ?? (() => {})} />
      </Match>
      <Match when={props.spec.kind === 'chalk-sets'}>
        <SetsRenderer spec={props.spec as unknown as ChalkSetsSpec} />
      </Match>
      <Match when={props.spec.kind === 'flex'}>
        <div
          class="flex data-[direction=row]:*:flex-1 data-[direction=row]:*:min-w-0"
          data-direction={(props.spec.direction as string) ?? 'column'}
          style={{
            'flex-direction': (props.spec.direction as string) ?? 'column',
            gap: (props.spec.gap as string) ?? '0.75rem',
            'align-items': props.spec.align as string | undefined,
            'justify-content': props.spec.justify as string | undefined,
            'flex-wrap': props.spec.wrap ? 'wrap' : undefined,
          }}
        >
          <For each={props.spec.children as ViewNodeProps['spec'][]}>
            {(child) => (
              <ViewNode spec={child} onGraphClick={props.onGraphClick} onDrawSubmit={props.onDrawSubmit} />
            )}
          </For>
        </div>
      </Match>
      <Match when={props.spec.kind === 'grid'}>
        <div
          class="grid *:min-w-0"
          style={{
            'grid-template-columns':
              (props.spec.columnTemplate as string) ??
              `repeat(${(props.spec.columns as number) ?? 2}, 1fr)`,
            gap: (props.spec.gap as string) ?? '0.75rem',
            'align-items': props.spec.align as string | undefined,
            'justify-content': props.spec.justify as string | undefined,
          }}
        >
          <For each={props.spec.children as ViewNodeProps['spec'][]}>
            {(child) => (
              <ViewNode spec={child} onGraphClick={props.onGraphClick} onDrawSubmit={props.onDrawSubmit} />
            )}
          </For>
        </div>
      </Match>
      <Match when={props.spec.kind === 'card'}>
        <div class="border border-slate-200 rounded-lg bg-white overflow-hidden">
          <Show when={props.spec.header as string | undefined}>
            <div class="py-2 px-3 border-b border-slate-200 bg-slate-50 font-semibold text-sm text-slate-700">{props.spec.header as string}</div>
          </Show>
          <div class="p-3 flex flex-col gap-2">
            <For each={props.spec.children as ViewNodeProps['spec'][]}>
              {(child) => (
                <ViewNode spec={child} onGraphClick={props.onGraphClick} onDrawSubmit={props.onDrawSubmit} />
              )}
            </For>
          </div>
        </div>
      </Match>
      <Match when={props.spec.kind === 'text'}>
        <div
          class="leading-normal data-[variant=body]:text-sm data-[variant=body]:text-slate-800 data-[variant=muted]:text-[13px] data-[variant=muted]:text-slate-500 data-[variant=small]:text-xs data-[variant=small]:text-slate-600"
          data-variant={(props.spec.variant as string) ?? 'body'}
        >
          <SpecRenderer
            spec={{ kind: 'markdown', content: props.spec.content as string } as unknown as RootSpec}
            apiBase=""
          />
        </div>
      </Match>
      <Match when={props.spec.kind === 'stat'}>
        <div class="flex flex-wrap gap-4">
          <For
            each={
              props.spec.stats as Array<{ label: string; value: number | string; description?: string }>
            }
          >
            {(s) => (
              <div class="flex flex-col gap-0.5 min-w-0">
                <div class="text-[11px] text-slate-500 uppercase tracking-wide font-medium">
                  <SpecRenderer spec={{ kind: 'markdown', content: String(s.label) } as unknown as RootSpec} apiBase="" />
                </div>
                <div class="text-xl font-semibold text-slate-800 tabular-nums">
                  <SpecRenderer spec={{ kind: 'markdown', content: String(s.value) } as unknown as RootSpec} apiBase="" />
                </div>
                <Show when={s.description}>
                  <div class="text-xs text-slate-400">
                    <SpecRenderer spec={{ kind: 'markdown', content: s.description! } as unknown as RootSpec} apiBase="" />
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Match>
      <Match when={true}>
        <SpecRenderer spec={props.spec as unknown as RootSpec} apiBase="" />
      </Match>
    </Switch>
  );
};

const ChalkSpecRenderer: Component<{
  chunks: ChalkViewSpec[];
  onGraphClick?: (points: Array<{ x: number; y: number }>) => void;
  onDrawSubmit?: (imageBase64: string) => void;
}> = (props) => {
  return (
    <div class="flex flex-col gap-2">
      <For each={props.chunks}>
        {(chunk) => (
          <ViewNode
            spec={chunk as ViewNodeProps['spec']}
            onGraphClick={props.onGraphClick}
            onDrawSubmit={props.onDrawSubmit}
          />
        )}
      </For>
    </div>
  );
};

export default ChalkSpecRenderer;
