import type { Component } from 'solid-js';
import { SpecRenderer } from '@retrofit-ui/spa-solid-shoelace/components';
import type { MarkdownViewSpec } from '@retrofit-ui/core';
import type { HarnessProps } from '../types';
import styles from './harness.module.css';

function messageToSpec(content: string): MarkdownViewSpec {
  return { kind: 'markdown', content };
}

const Harness: Component<HarnessProps> = (props) => {
  if (props.message.role === 'user') {
    return <div class={styles.userContent}>{props.message.content}</div>;
  }
  return <SpecRenderer spec={messageToSpec(props.message.content)} apiBase="" />;
};

export default Harness;
