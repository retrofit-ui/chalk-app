import type { Component } from 'solid-js';
import styles from './MessageActions.module.css';

type Props = {
  index: number;
  onFork: (index: number) => void;
  onRevert: (index: number) => void;
};

const MessageActions: Component<Props> = (props) => {
  return (
    <div class={styles.actions}>
      <button
        class={styles.btn}
        title="Fork conversation from this message"
        onClick={() => props.onFork(props.index)}
      >
        ⎇ fork
      </button>
      <button
        class={styles.btn}
        title="Revert conversation to this message"
        onClick={() => props.onRevert(props.index)}
      >
        ↩ revert
      </button>
    </div>
  );
};

export default MessageActions;
