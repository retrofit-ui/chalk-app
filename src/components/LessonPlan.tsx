import { createSignal, For, Show, type Component } from 'solid-js';
import { SpecRenderer } from '@retrofit-ui/spa-solid-shoelace/components';
import type { MarkdownViewSpec } from '@retrofit-ui/core';
import styles from './LessonPlan.module.css';

type Props = {
  plans: string[];
  onSave: (newPlan: string) => void;
  onClose: () => void;
};

function toSpec(content: string): MarkdownViewSpec {
  return { kind: 'markdown', content };
}

const LessonPlan: Component<Props> = (props) => {
  const currentPlan = () => props.plans[props.plans.length - 1] ?? '';
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal('');
  const [historyOpen, setHistoryOpen] = createSignal(false);

  const startEdit = () => {
    setDraft(currentPlan());
    setEditing(true);
  };

  const save = () => {
    const text = draft().trim();
    if (text) props.onSave(text);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  return (
    <div class={styles.panel}>
      <header class={styles.header}>
          <span class={styles.title}>Lesson plan</span>
          <div class={styles.headerActions}>
            <Show when={!editing()}>
              <button class={styles.actionBtn} onClick={startEdit}>Edit</button>
            </Show>
            <button class={styles.closeBtn} onClick={props.onClose}>✕</button>
          </div>
        </header>

        <div class={styles.body}>
          <Show
            when={editing()}
            fallback={
              <Show
                when={currentPlan()}
                fallback={<p class={styles.empty}>No lesson plan yet. Click Edit to add one.</p>}
              >
                <div class={styles.rendered}>
                  <SpecRenderer spec={toSpec(currentPlan())} apiBase="" />
                </div>
              </Show>
            }
          >
            <textarea
              class={styles.textarea}
              value={draft()}
              onInput={(e) => setDraft(e.currentTarget.value)}
              rows={16}
              placeholder="Write a lesson plan in markdown…"
            />
            <div class={styles.editActions}>
              <button class={styles.saveBtn} onClick={save} disabled={!draft().trim()}>Save</button>
              <button class={styles.cancelBtn} onClick={cancel}>Cancel</button>
            </div>
          </Show>
        </div>

        <Show when={props.plans.length > 1}>
          <div class={styles.history}>
            <button
              class={styles.historyToggle}
              onClick={() => setHistoryOpen((o) => !o)}
            >
              {historyOpen() ? '▾' : '▸'} History ({props.plans.length - 1} earlier {props.plans.length === 2 ? 'version' : 'versions'})
            </button>
            <Show when={historyOpen()}>
              <For each={props.plans.slice(0, -1).reverse()}>
                {(plan, i) => (
                  <details class={styles.historyItem}>
                    <summary class={styles.historyLabel}>Version {props.plans.length - 1 - i()}</summary>
                    <div class={styles.historyContent}>
                      <SpecRenderer spec={toSpec(plan)} apiBase="" />
                    </div>
                  </details>
                )}
              </For>
            </Show>
          </div>
        </Show>
    </div>
  );
};

export default LessonPlan;
