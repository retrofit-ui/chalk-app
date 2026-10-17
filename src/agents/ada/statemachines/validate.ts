// Shared structural checks: model-written specs are untrusted input, so every renderer
// validates before running an engine and shows the problems instead of crashing.

export function checkStates(states: unknown, label = 'states'): string[] {
  if (!Array.isArray(states) || states.length === 0) return [`\`${label}\` must be a non-empty array.`];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const s of states as Array<{ id?: unknown }>) {
    if (typeof s?.id !== 'string' || !s.id) errors.push('Every state needs a string `id`.');
    else if (seen.has(s.id)) errors.push(`Duplicate state id "${s.id}".`);
    else seen.add(s.id);
  }
  return errors;
}

export const stateIds = (states: Array<{ id: string }>) => new Set(states.map((s) => s.id));

export function checkRef(ids: Set<string>, id: unknown, where: string): string[] {
  return typeof id === 'string' && ids.has(id) ? [] : [`${where} refers to unknown state "${String(id)}".`];
}
