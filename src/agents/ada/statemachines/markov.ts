import type { ChalkMarkovSpec, MarkovTransition } from '../spec';
import { seededRandom } from './rng';
import { checkRef, checkStates, stateIds } from './validate';

const EPS = 1e-9;

export function transitionMatrix(spec: ChalkMarkovSpec): number[][] {
  const index = new Map(spec.states.map((s, i) => [s.id, i]));
  const P = spec.states.map(() => spec.states.map(() => 0));
  for (const t of spec.transitions) {
    const i = index.get(t.from);
    const j = index.get(t.to);
    if (i !== undefined && j !== undefined) P[i][j] += t.p;
  }
  return P;
}

export function rowSumErrors(spec: ChalkMarkovSpec): Array<{ id: string; sum: number }> {
  return transitionMatrix(spec)
    .map((row, i) => ({ id: spec.states[i].id, sum: Number(row.reduce((a, b) => a + b, 0).toFixed(6)) }))
    .filter((r) => Math.abs(r.sum - 1) > 1e-6);
}

const step = (P: number[][], pi: number[]) => pi.map((_, j) => pi.reduce((acc, pk, k) => acc + pk * P[k][j], 0));

/** π_n = π_0 · Pⁿ */
export function distributionAt(P: number[][], pi0: number[], n: number): number[] {
  let pi = [...pi0];
  for (let k = 0; k < n; k++) pi = step(P, pi);
  return pi;
}

/**
 * Long-run fraction of time in each state from this start. For an ergodic chain that is the
 * stationary distribution (power iteration converges); for a periodic chain πₙ oscillates
 * forever, so fall back to the running (Cesàro) average, which always converges.
 */
export function longRunDistribution(P: number[][], pi0: number[]): number[] {
  let pi = [...pi0];
  for (let k = 0; k < 5000; k++) {
    const next = step(P, pi);
    const delta = Math.max(...next.map((v, i) => Math.abs(v - pi[i])));
    pi = next;
    if (delta < 1e-13) return pi;
  }
  const N = 20000;
  pi = [...pi0];
  const sum = pi.map(() => 0);
  for (let k = 0; k < N; k++) {
    pi.forEach((v, i) => (sum[i] += v));
    pi = step(P, pi);
  }
  return sum.map((v) => v / N);
}

/** Gaussian elimination with partial pivoting; null when singular. */
function solve(A: number[][], b: number[][]): number[][] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...b[i]]);
  const w = M[0]?.length ?? 0;
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    if (Math.abs(M[pivot][c]) < 1e-12) return null;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k < w; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row.slice(n).map((v) => v / M[i][i]));
}

export type AbsorptionAnalysis = {
  absorbing: number[]; // state indices with P[i][i] = 1
  expectedSteps: number[]; // per state: 0 if absorbing, Infinity if absorption is impossible
  absorptionProbabilities: number[][]; // [from][absorbing state index] = probability of ending there
};

/** Fundamental-matrix analysis: t = (I − Q)⁻¹·1 and B = (I − Q)⁻¹·R over the transient states. */
export function absorptionAnalysis(P: number[][]): AbsorptionAnalysis {
  const n = P.length;
  const absorbing = P.map((row, i) => i).filter((i) => Math.abs(P[i][i] - 1) < EPS);
  const isAbs = new Set(absorbing);
  const probs: number[][] = P.map((_, i) => P.map((__, j) => (i === j && isAbs.has(i) ? 1 : 0)));
  const expectedSteps = P.map((_, i) => (isAbs.has(i) ? 0 : Infinity));
  if (absorbing.length === 0) return { absorbing, expectedSteps, absorptionProbabilities: probs };

  // transient states that can reach an absorbing state; the rest never get absorbed
  const reaches = new Set(absorbing);
  let grew = true;
  while (grew) {
    grew = false;
    for (let i = 0; i < n; i++) {
      if (!reaches.has(i) && P[i].some((p, j) => p > EPS && reaches.has(j))) {
        reaches.add(i);
        grew = true;
      }
    }
  }
  // Absorption is certain only if the state can't wander into a region that never absorbs.
  const certain = new Set(absorbing);
  for (const i of reaches) if (!isAbs.has(i)) certain.add(i);
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of [...certain]) {
      if (!isAbs.has(i) && P[i].some((p, j) => p > EPS && !certain.has(j))) {
        certain.delete(i);
        changed = true;
      }
    }
  }
  const T = [...certain].filter((i) => !isAbs.has(i)).sort((a, b) => a - b);
  if (T.length === 0) return { absorbing, expectedSteps, absorptionProbabilities: probs };

  const IminusQ = T.map((i) => T.map((j) => (i === j ? 1 : 0) - P[i][j]));
  const rhs = T.map((i) => [1, ...absorbing.map((a) => P[i][a])]);
  const sol = solve(IminusQ, rhs);
  if (sol) {
    T.forEach((i, r) => {
      expectedSteps[i] = sol[r][0];
      absorbing.forEach((a, k) => (probs[i][a] = sol[r][k + 1]));
    });
  }
  return { absorbing, expectedSteps, absorptionProbabilities: probs };
}

export function sampleWalk(P: number[][], start: number, steps: number, seed = 1): number[] {
  const rand = seededRandom(seed);
  const walk = [start];
  let cur = start;
  for (let k = 0; k < steps; k++) {
    const row = P[cur];
    const total = row.reduce((a, b) => a + b, 0);
    if (total <= EPS) break;
    let r = rand() * total;
    let next = row.findIndex((p) => p > 0);
    for (let j = 0; j < row.length; j++) {
      if (row[j] <= 0) continue;
      next = j;
      r -= row[j];
      if (r < 0) break;
    }
    walk.push(next);
    cur = next;
  }
  return walk;
}

/**
 * Sets one probability and rescales that state's other outgoing edges proportionally so the
 * row still sums to 1 (Setosa's playground turns a bad row red; here it can't go bad).
 */
export function setProbability(spec: ChalkMarkovSpec, from: string, to: string, p: number): MarkovTransition[] {
  const value = Math.min(1, Math.max(0, p));
  const row = spec.transitions.map((t, i) => ({ t, i })).filter(({ t }) => t.from === from);
  const target = row.find(({ t }) => t.to === to);
  if (!target) return spec.transitions;
  const others = row.filter(({ i }) => i !== target.i);
  if (others.length === 0) return spec.transitions.map((t, i) => (i === target.i ? { ...t, p: 1 } : t));
  const rest = 1 - value;
  const otherSum = others.reduce((a, { t }) => a + t.p, 0);
  const next = spec.transitions.map((t) => ({ ...t }));
  next[target.i].p = value;
  for (const { t, i } of others) next[i].p = otherSum > EPS ? (t.p / otherSum) * rest : rest / others.length;
  return next;
}

export function validateMarkov(spec: ChalkMarkovSpec): string[] {
  const errors = checkStates(spec?.states);
  if (errors.length) return errors;
  const ids = stateIds(spec.states);
  if (!Array.isArray(spec.transitions)) return ['`transitions` must be an array.'];
  if (spec.start !== undefined) errors.push(...checkRef(ids, spec.start, '`start`'));
  spec.transitions.forEach((t, i) => {
    errors.push(...checkRef(ids, t.from, `Transition ${i + 1} \`from\``), ...checkRef(ids, t.to, `Transition ${i + 1} \`to\``));
    if (!(typeof t.p === 'number' && t.p >= 0)) errors.push(`Transition ${i + 1} has a negative or non-numeric probability.`);
  });
  for (const r of rowSumErrors(spec)) errors.push(`Probabilities out of "${r.id}" sum to ${r.sum}, not 1.`);
  return errors;
}
