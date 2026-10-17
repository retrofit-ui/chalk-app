import type { ChalkMdpSpec } from '../spec';
import { checkRef, checkStates, stateIds } from './validate';

export type MdpFrame = {
  sweep: number;
  V: Record<string, number>;
  Q: number[]; // per action index, from the backup that produced V
  policy: Record<string, number | null>; // greedy action index per state
  delta: number; // max |V_k − V_{k−1}|
};

export type BackupTerm = { to: string; p: number; reward: number; nextValue: number; contribution: number };

/** Q(s,a) = Σ p · (r + γ·V(s')) — the piece of the Bellman equation the hover panel spells out. */
export function bellmanBackup(spec: ChalkMdpSpec, V: Record<string, number>, actionIndex: number, gamma: number) {
  const terms: BackupTerm[] = spec.actions[actionIndex].outcomes.map((o) => {
    const reward = o.reward ?? 0;
    const nextValue = V[o.to] ?? 0;
    return { to: o.to, p: o.p, reward, nextValue, contribution: o.p * (reward + gamma * nextValue) };
  });
  return { terms, total: terms.reduce((a, t) => a + t.contribution, 0) };
}

/** Synchronous value iteration from V₀ = 0, one frame per sweep, until the change drops below tol. */
export function valueIteration(
  spec: ChalkMdpSpec,
  gamma: number,
  opts: { maxSweeps?: number; tol?: number } = {},
): MdpFrame[] {
  const maxSweeps = opts.maxSweeps ?? 1000;
  const tol = opts.tol ?? 1e-6;
  const terminal = new Set(spec.states.filter((s) => s.terminal).map((s) => s.id));
  const byState = new Map<string, number[]>(spec.states.map((s) => [s.id, []]));
  spec.actions.forEach((a, i) => byState.get(a.from)?.push(i));

  let V: Record<string, number> = Object.fromEntries(spec.states.map((s) => [s.id, 0]));
  const frames: MdpFrame[] = [
    {
      sweep: 0,
      V,
      Q: spec.actions.map(() => 0),
      policy: Object.fromEntries(spec.states.map((s) => [s.id, null])),
      delta: Infinity,
    },
  ];

  for (let k = 1; k <= maxSweeps; k++) {
    const Q = spec.actions.map((_, i) => bellmanBackup(spec, V, i, gamma).total);
    const next: Record<string, number> = {};
    const policy: Record<string, number | null> = {};
    for (const s of spec.states) {
      const acts = byState.get(s.id)!;
      if (terminal.has(s.id) || acts.length === 0) {
        next[s.id] = 0;
        policy[s.id] = null;
        continue;
      }
      let best = acts[0];
      for (const a of acts) if (Q[a] > Q[best] + 1e-12) best = a;
      next[s.id] = Q[best];
      policy[s.id] = best;
    }
    const delta = Math.max(0, ...spec.states.map((s) => Math.abs(next[s.id] - V[s.id])));
    V = next;
    frames.push({ sweep: k, V, Q, policy, delta });
    if (delta < tol) break;
  }
  return frames;
}

export function validateMdp(spec: ChalkMdpSpec): string[] {
  const errors = checkStates(spec?.states);
  if (errors.length) return errors;
  const ids = stateIds(spec.states);
  if (!Array.isArray(spec.actions)) return ['`actions` must be an array.'];
  if (spec.gamma !== undefined && !(spec.gamma >= 0 && spec.gamma <= 1)) errors.push('`gamma` must be between 0 and 1.');
  spec.actions.forEach((a, i) => {
    const where = `Action "${a.name ?? i + 1}"`;
    errors.push(...checkRef(ids, a.from, `${where} \`from\``));
    if (!Array.isArray(a.outcomes) || a.outcomes.length === 0) {
      errors.push(`${where} needs at least one outcome.`);
      return;
    }
    a.outcomes.forEach((o) => errors.push(...checkRef(ids, o.to, `${where} outcome`)));
    const sum = a.outcomes.reduce((acc, o) => acc + (o.p ?? 0), 0);
    if (Math.abs(sum - 1) > 1e-6) errors.push(`${where} outcome probabilities sum to ${Number(sum.toFixed(6))}, not 1.`);
  });
  return errors;
}
