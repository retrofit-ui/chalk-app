import { For, Show, type Component } from 'solid-js';
import {
  DATE_GROUPS,
  groupConversations,
  type Conversation,
  type DateGroup,
} from './conversations';
import { EXAMPLES } from './examples/index';

const itemClass =
  'block w-full text-left bg-transparent border-none py-1.5 px-3.5 text-sm text-gray-700 cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis hover:bg-gray-100 hover:text-gray-900';
const activeClass = 'bg-gray-200 text-gray-900 font-medium';
const childClass =
  'pl-6 text-gray-500 text-xs border-l-2 border-gray-200 ml-3.5';
const exampleClass = 'text-gray-500 italic';

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  childMap: Map<string, Conversation[]>;
  onNew: () => void;
  onSelect: (conv: Conversation) => void;
  onSelectExample: (conv: Conversation) => void;
  onDelete: (conv: Conversation) => void;
};

const deleteClass =
  'absolute right-1.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-gray-400 cursor-pointer text-sm leading-none px-1 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-600';

const Sidebar: Component<Props> = (props) => {
  const Item = (p: { conv: Conversation; class: string; label: string }) => (
    <div class="group relative">
      <button
        class={`${itemClass} ${p.class} pr-7 ${props.activeId === p.conv.id ? activeClass : ''}`}
        onClick={() => props.onSelect(p.conv)}
      >
        {p.label}
      </button>
      <button
        class={deleteClass}
        title="Delete chat"
        aria-label={`Delete “${p.conv.title}”`}
        onClick={() => props.onDelete(p.conv)}
      >
        ×
      </button>
    </div>
  );

  // Only top-level (non-forked) convs appear in date groups
  const topLevel = () => props.conversations.filter((c) => !c.provenance);
  const grouped = () => groupConversations(topLevel());

  return (
    <nav class="w-60 flex-shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-gray-50">
      <div class="pt-4 px-3 pb-3 flex items-center gap-2 border-b border-gray-200 flex-shrink-0">
        <span class="font-light text-base tracking-tight text-green-900">chalk</span>
        <button
          class="ml-auto bg-transparent border border-gray-300 rounded-md py-1 px-2.5 text-xs cursor-pointer text-gray-600 whitespace-nowrap hover:bg-gray-100 hover:text-gray-900"
          onClick={props.onNew}
        >
          + New chat
        </button>
      </div>

      <div class="flex-1 overflow-y-auto py-2">
        <For each={DATE_GROUPS}>
          {(group: DateGroup) => (
            <Show when={grouped()[group].length > 0}>
              <div class="mb-1">
                <div class="text-xs uppercase tracking-wider text-gray-400 pt-2 px-3.5 pb-1 font-medium">{group}</div>
                <For each={grouped()[group]}>
                  {(conv) => (
                    <>
                      <Item conv={conv} class="" label={conv.title} />
                      <For each={props.childMap.get(conv.id) ?? []}>
                        {(child) => <Item conv={child} class={childClass} label={`⎇ ${child.title}`} />}
                      </For>
                    </>
                  )}
                </For>
              </div>
            </Show>
          )}
        </For>

        <div class="mb-1">
          <div class="text-xs uppercase tracking-wider text-gray-400 pt-2 px-3.5 pb-1 font-medium">Examples</div>
          <For each={EXAMPLES}>
            {(conv) => (
              <button
                class={`${itemClass} ${exampleClass}`}
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
