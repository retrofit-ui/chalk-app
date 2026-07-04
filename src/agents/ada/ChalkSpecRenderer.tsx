import { type Component, For, Match, Switch } from 'solid-js';
import { SpecRenderer } from '@retrofit-ui/spa-solid-shoelace/components';
import type { RootSpec } from '@retrofit-ui/core';
import type { ChalkViewSpec, ChalkGraphSpec, ChalkDrawSpec, ChalkSetsSpec } from './spec';
import CartesianGraph from './CartesianGraph';
import DrawCanvas from './DrawCanvas';
import SetsRenderer from './SetsRenderer';
import styles from './ChalkSpecRenderer.module.css';

const ChalkSpecRenderer: Component<{
  chunks: ChalkViewSpec[];
  onGraphClick?: (points: Array<{ x: number; y: number }>) => void;
  onDrawSubmit?: (imageBase64: string) => void;
}> = (props) => {
  return (
    <div class={styles.column}>
      <For each={props.chunks}>
        {(chunk) => (
          <Switch>
            <Match when={chunk.kind === 'chalk-graph'}>
              <CartesianGraph spec={chunk as ChalkGraphSpec} onGraphClick={props.onGraphClick} />
            </Match>
            <Match when={chunk.kind === 'chalk-draw'}>
              <DrawCanvas spec={chunk as ChalkDrawSpec} onSubmit={props.onDrawSubmit ?? (() => {})} />
            </Match>
            <Match when={chunk.kind === 'chalk-sets'}>
              <SetsRenderer spec={chunk as ChalkSetsSpec} />
            </Match>
            <Match when={true}>
              <SpecRenderer spec={chunk as RootSpec} apiBase="" />
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
};

export default ChalkSpecRenderer;
