import type { JSX, Component } from 'solid-js';
import styles from './ReplyBox.module.css';

type Props = {
  children: JSX.Element;
};

const ReplyBox: Component<Props> = (props) => (
  <div class={styles.replyBox}>
    {props.children}
  </div>
);

export default ReplyBox;
