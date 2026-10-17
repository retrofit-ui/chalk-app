import type { ChalkAutomatonSpec } from '../spec';
import { checkRef, checkStates, stateIds } from './validate';

export type AutomatonStatus = 'running' | 'accepted' | 'rejected';

export type AutomatonFrame = {
  consumed: number; // how many input symbols have been read
  active: string[]; // current state(s), in declaration order; several for an NFA
  fired: number[]; // transition indices taken to reach this frame (including epsilon moves)
  status: AutomatonStatus;
};

const isEpsilon = (s: string) => s === '' || s === 'ε' || s === 'eps' || s === 'epsilon';

export function alphabet(spec: ChalkAutomatonSpec): string[] {
  const out = new Set<string>();
  for (const t of spec.transitions ?? []) for (const s of t.symbols ?? []) if (!isEpsilon(s)) out.add(s);
  return [...out];
}

/** Single-character alphabets are typed as plain strings ("abba"); word alphabets ("coin push") as words. */
export function tokenize(spec: ChalkAutomatonSpec, text: string): string[] {
  const words = alphabet(spec).some((s) => s.length > 1);
  if (words) return text.split(/[\s,]+/).filter(Boolean);
  return [...text].filter((c) => !/\s/.test(c));
}

const order = (spec: ChalkAutomatonSpec, ids: Iterable<string>) => {
  const set = new Set(ids);
  return spec.states.map((s) => s.id).filter((id) => set.has(id));
};

function closureWithEdges(spec: ChalkAutomatonSpec, start: Iterable<string>): { states: string[]; edges: number[] } {
  const seen = new Set(start);
  const edges: number[] = [];
  const stack = [...seen];
  while (stack.length) {
    const cur = stack.pop()!;
    spec.transitions.forEach((t, i) => {
      if (t.from === cur && t.symbols.some(isEpsilon)) {
        edges.push(i);
        if (!seen.has(t.to)) {
          seen.add(t.to);
          stack.push(t.to);
        }
      }
    });
  }
  return { states: order(spec, seen), edges };
}

export function epsilonClosure(spec: ChalkAutomatonSpec, states: string[]): string[] {
  return closureWithEdges(spec, states).states;
}

const statusOf = (spec: ChalkAutomatonSpec, active: string[]): AutomatonStatus => {
  const accepting = new Set(spec.states.filter((s) => s.accept).map((s) => s.id));
  return active.some((id) => accepting.has(id)) ? 'accepted' : 'rejected';
};

/** Simulates by subset tracking, so a DFA and an NFA run through the same code. */
export function runAutomaton(spec: ChalkAutomatonSpec, tokens: string[]): AutomatonFrame[] {
  const init = closureWithEdges(spec, [spec.start]);
  const frames: AutomatonFrame[] = [{ consumed: 0, active: init.states, fired: [], status: 'running' }];
  let active = init.states;

  for (let i = 0; i < tokens.length; i++) {
    const sym = tokens[i];
    const next = new Set<string>();
    const fired: number[] = [];
    spec.transitions.forEach((t, idx) => {
      if (active.includes(t.from) && t.symbols.includes(sym)) {
        next.add(t.to);
        fired.push(idx);
      }
    });
    const closed = closureWithEdges(spec, next);
    active = closed.states;
    frames.push({ consumed: i + 1, active, fired: [...fired, ...closed.edges], status: 'running' });
    if (active.length === 0) break;
  }

  const last = frames[frames.length - 1];
  last.status = last.active.length === 0 ? 'rejected' : statusOf(spec, last.active);
  return frames;
}

export function isDeterministic(spec: ChalkAutomatonSpec): boolean {
  const seen = new Set<string>();
  for (const t of spec.transitions) {
    for (const s of t.symbols) {
      if (isEpsilon(s)) return false;
      const key = `${t.from}\u0000${s}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

export function validateAutomaton(spec: ChalkAutomatonSpec): string[] {
  const errors = checkStates(spec?.states);
  if (errors.length) return errors;
  const ids = stateIds(spec.states);
  errors.push(...checkRef(ids, spec.start, '`start`'));
  if (!Array.isArray(spec.transitions)) return [...errors, '`transitions` must be an array.'];
  spec.transitions.forEach((t, i) => {
    errors.push(...checkRef(ids, t.from, `Transition ${i + 1} \`from\``));
    errors.push(...checkRef(ids, t.to, `Transition ${i + 1} \`to\``));
    if (!Array.isArray(t.symbols)) errors.push(`Transition ${i + 1} needs a \`symbols\` array.`);
  });
  return errors;
}
