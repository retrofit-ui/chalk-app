import { type Component, For } from 'solid-js';

/** Shown in place of a diagram when a model-written spec doesn't hold together. */
const SpecErrors: Component<{ kind: string; errors: string[] }> = (props) => (
  <div data-testid="spec-errors" class="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2">
    <div class="font-semibold mb-1">This {props.kind} diagram can't be drawn:</div>
    <ul class="list-disc pl-4">
      <For each={props.errors}>{(e) => <li>{e}</li>}</For>
    </ul>
  </div>
);

export default SpecErrors;
