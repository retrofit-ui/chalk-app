import { createSignal, For, Show, type Component } from 'solid-js';
import { SpecRenderer } from '@retrofit-ui/spa-solid-shoelace/components';
import type { MarkdownViewSpec } from '@retrofit-ui/core';

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
    <div class="w-90 flex-shrink-0 h-screen border-l border-gray-200 bg-white flex flex-col overflow-hidden">
      <header class="flex items-center py-4 px-5 border-b border-gray-200 flex-shrink-0">
          <span class="text-sm font-semibold text-gray-900 flex-1">Lesson plan</span>
          <div class="flex items-center gap-2">
            <Show when={!editing()}>
              <button
                class="bg-transparent border border-gray-300 rounded-md py-1 px-3 text-sm cursor-pointer text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                onClick={startEdit}
              >
                Edit
              </button>
            </Show>
            <button
              class="bg-transparent border-none text-base text-gray-400 cursor-pointer py-0 px-1 leading-none hover:text-gray-700"
              onClick={props.onClose}
            >
              ✕
            </button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          <Show
            when={editing()}
            fallback={
              <Show
                when={currentPlan()}
                fallback={<p class="text-gray-400 text-sm m-0">No lesson plan yet. Click Edit to add one.</p>}
              >
                <div class="text-sm leading-relaxed">
                  <SpecRenderer spec={toSpec(currentPlan())} apiBase="" />
                </div>
              </Show>
            }
          >
            <textarea
              class="w-full resize-y border border-gray-300 rounded-lg p-3 text-sm leading-normal outline-none box-border focus:border-gray-500"
              value={draft()}
              onInput={(e) => setDraft(e.currentTarget.value)}
              rows={16}
              placeholder="Write a lesson plan in markdown…"
            />
            <div class="flex gap-2">
              <button
                class="border-none bg-gray-900 text-white py-2 px-4.5 rounded-md cursor-pointer text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                onClick={save}
                disabled={!draft().trim()}
              >
                Save
              </button>
              <button
                class="bg-transparent border border-gray-300 rounded-md py-2 px-3.5 text-sm cursor-pointer text-gray-500 hover:bg-gray-100"
                onClick={cancel}
              >
                Cancel
              </button>
            </div>
          </Show>
        </div>

        <Show when={props.plans.length > 1}>
          <div class="border-t border-gray-200 py-3 px-5 flex-shrink-0">
            <button
              class="bg-transparent border-none text-xs text-gray-500 cursor-pointer p-0 text-left hover:text-gray-700"
              onClick={() => setHistoryOpen((o) => !o)}
            >
              {historyOpen() ? '▾' : '▸'} History ({props.plans.length - 1} earlier {props.plans.length === 2 ? 'version' : 'versions'})
            </button>
            <Show when={historyOpen()}>
              <For each={props.plans.slice(0, -1).reverse()}>
                {(plan, i) => (
                  <details class="mt-2">
                    <summary class="text-xs text-gray-400 cursor-pointer py-1">Version {props.plans.length - 1 - i()}</summary>
                    <div class="text-sm leading-normal text-gray-500 pt-2 pr-0 pb-1 pl-3 border-l-2 border-gray-200 mt-1">
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
