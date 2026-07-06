import { type Component, For, Match, Show, Switch } from 'solid-js';
import { SpecRenderer } from '@retrofit-ui/spa-solid-shoelace/components';
import type { RootSpec } from '@retrofit-ui/core';
import type { ChalkViewSpec, ChalkGraphSpec, ChalkDrawSpec, ChalkSetsSpec } from './spec';
import CartesianGraph from './CartesianGraph';
import DrawCanvas from './DrawCanvas';
import SetsRenderer from './SetsRenderer';
import styles from './ChalkSpecRenderer.module.css';

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
          class={styles.flex}
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
          class={styles.grid}
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
        <div class={styles.card}>
          <Show when={props.spec.header as string | undefined}>
            <div class={styles.cardHeader}>{props.spec.header as string}</div>
          </Show>
          <div class={styles.cardBody}>
            <For each={props.spec.children as ViewNodeProps['spec'][]}>
              {(child) => (
                <ViewNode spec={child} onGraphClick={props.onGraphClick} onDrawSubmit={props.onDrawSubmit} />
              )}
            </For>
          </div>
        </div>
      </Match>
      <Match when={props.spec.kind === 'text'}>
        <div class={styles.text} data-variant={(props.spec.variant as string) ?? 'body'}>
          <SpecRenderer
            spec={{ kind: 'markdown', content: props.spec.content as string } as unknown as RootSpec}
            apiBase=""
          />
        </div>
      </Match>
      <Match when={props.spec.kind === 'stat'}>
        <div class={styles.statGrid}>
          <For
            each={
              props.spec.stats as Array<{ label: string; value: number | string; description?: string }>
            }
          >
            {(s) => (
              <div class={styles.stat}>
                <div class={styles.statLabel}>{s.label}</div>
                <div class={styles.statValue}>{s.value}</div>
                <Show when={s.description}>
                  <div class={styles.statDescription}>{s.description}</div>
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
    <div class={styles.column}>
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
