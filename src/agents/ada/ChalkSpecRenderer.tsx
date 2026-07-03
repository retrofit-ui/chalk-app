import { type Component, For, Match, Switch } from 'solid-js';
import { SpecRenderer } from '@retrofit-ui/spa-solid-shoelace/components';
import type { RootSpec } from '@retrofit-ui/core';
import type { ChalkViewSpec, ChalkGraphSpec } from './spec';
import CartesianGraph from './CartesianGraph';
import styles from './ChalkSpecRenderer.module.css';

const ChalkSpecRenderer: Component<{ chunks: ChalkViewSpec[] }> = (props) => {
  return (
    <div class={styles.column}>
      <For each={props.chunks}>
        {(chunk) => (
          <Switch>
            <Match when={chunk.kind === 'chalk-graph'}>
              <CartesianGraph spec={chunk as ChalkGraphSpec} />
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
