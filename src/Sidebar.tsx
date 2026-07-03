import { For, Show, type Component } from 'solid-js';
import {
  DATE_GROUPS,
  groupConversations,
  type Conversation,
  type DateGroup,
} from './conversations';
import { EXAMPLES } from './examples/index';
import styles from './Sidebar.module.css';

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  childMap: Map<string, Conversation[]>;
  onNew: () => void;
  onSelect: (conv: Conversation) => void;
  onSelectExample: (conv: Conversation) => void;
};

const Sidebar: Component<Props> = (props) => {
  // Only top-level (non-forked) convs appear in date groups
  const topLevel = () => props.conversations.filter((c) => !c.provenance);
  const grouped = () => groupConversations(topLevel());

  return (
    <nav class={styles.sidebar}>
      <div class={styles.top}>
        <span class={styles.logo}>chalk</span>
        <button class={styles.newBtn} onClick={props.onNew}>
          + New chat
        </button>
      </div>

      <div class={styles.list}>
        <For each={DATE_GROUPS}>
          {(group: DateGroup) => (
            <Show when={grouped()[group].length > 0}>
              <div class={styles.group}>
                <div class={styles.groupLabel}>{group}</div>
                <For each={grouped()[group]}>
                  {(conv) => (
                    <>
                      <button
                        class={`${styles.item} ${props.activeId === conv.id ? styles.active : ''}`}
                        onClick={() => props.onSelect(conv)}
                      >
                        {conv.title}
                      </button>
                      <For each={props.childMap.get(conv.id) ?? []}>
                        {(child) => (
                          <button
                            class={`${styles.item} ${styles.child} ${props.activeId === child.id ? styles.active : ''}`}
                            onClick={() => props.onSelect(child)}
                          >
                            ⎇ {child.title}
                          </button>
                        )}
                      </For>
                    </>
                  )}
                </For>
              </div>
            </Show>
          )}
        </For>

        <div class={styles.group}>
          <div class={styles.groupLabel}>Examples</div>
          <For each={EXAMPLES}>
            {(conv) => (
              <button
                class={`${styles.item} ${styles.example}`}
                onClick={() => props.onSelectExample(conv)}
              >
                {conv.title}
              </button>
            )}
          </For>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
