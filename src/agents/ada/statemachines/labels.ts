/** Display name for a state id: its label if it has one. Lists and status lines use this so
 * they match what the diagram draws. */
export const labeller = (states: Array<{ id: string; label?: string }>) => {
  const map = new Map(states.map((s) => [s.id, s.label ?? s.id]));
  return (id: string) => map.get(id) ?? id;
};
