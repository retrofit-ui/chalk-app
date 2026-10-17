// Tolerant parser for the JSON body of a chalk-spec fence that is still
// streaming. Unlike JSON.parse it never fails on truncated input; it returns
// the largest value that is safe to render so far:
//
//   - open strings are kept (text types itself out), except for keys in
//     ATOMIC_KEYS, whose half-typed values would be wrong rather than short
//     ("chalk-gr" is not a kind, "q1" is not "q12")
//   - unterminated numbers and literals are dropped: "12" may become "125",
//     and showing it would make the render jump
//   - a key with no value yet is dropped
//   - an open trailing array element is dropped (a half-written point or
//     matrix row would draw wrong), except objects in a `children` array,
//     which are view nodes the renderer shows progressively
//
// Every object and array whose closing bracket has not arrived is recorded in
// `incompleteNodes`, so the renderer can tell "still streaming" from "broken".
// Malformed (not merely truncated) input throws, like JSON.parse.

const ATOMIC_KEYS = new Set(['kind', 'identifier']);
const OPEN_ELEMENT_KEYS = new Set(['children']);

const incomplete = new WeakSet<object>();

export function isIncomplete(node: unknown): boolean {
  return typeof node === 'object' && node !== null && incomplete.has(node);
}

export function markIncomplete<T extends object>(node: T): T {
  incomplete.add(node);
  return node;
}

const MISSING = Symbol('missing');
type Parsed = { value: unknown; done: boolean };

export function parsePartialJson(text: string): unknown {
  const p = new Parser(text);
  const { value } = p.value(undefined);
  return value === MISSING ? undefined : value;
}

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  value(key: string | undefined): Parsed {
    this.ws();
    if (this.i >= this.s.length) return { value: MISSING, done: false };
    const c = this.s[this.i];
    if (c === '{') return this.object();
    if (c === '[') return this.array(key);
    if (c === '"') {
      const r = this.string();
      if (!r.done && key !== undefined && ATOMIC_KEYS.has(key)) return { value: MISSING, done: false };
      return r;
    }
    if (c === '-' || (c >= '0' && c <= '9')) return this.number();
    return this.literal();
  }

  private object(): Parsed {
    const obj: Record<string, unknown> = {};
    this.i++; // {
    for (;;) {
      this.ws();
      if (this.i >= this.s.length) return { value: markIncomplete(obj), done: false };
      if (this.s[this.i] === '}') {
        this.i++;
        return { value: obj, done: true };
      }
      if (this.s[this.i] === ',') {
        this.i++;
        continue;
      }
      if (this.s[this.i] !== '"') this.fail();
      const k = this.string();
      if (!k.done) return { value: markIncomplete(obj), done: false };
      this.ws();
      if (this.i >= this.s.length) return { value: markIncomplete(obj), done: false };
      if (this.s[this.i] !== ':') this.fail();
      this.i++;
      const key = k.value as string;
      const v = this.value(key);
      if (v.value !== MISSING) obj[key] = v.value;
      if (!v.done) return { value: markIncomplete(obj), done: false };
    }
  }

  private array(key: string | undefined): Parsed {
    const arr: unknown[] = [];
    this.i++; // [
    for (;;) {
      this.ws();
      if (this.i >= this.s.length) return { value: markIncomplete(arr), done: false };
      if (this.s[this.i] === ']') {
        this.i++;
        return { value: arr, done: true };
      }
      if (this.s[this.i] === ',') {
        this.i++;
        continue;
      }
      const v = this.value(undefined);
      if (v.done) {
        arr.push(v.value);
        continue;
      }
      const keepOpen =
        key !== undefined && OPEN_ELEMENT_KEYS.has(key) && isPlainObject(v.value);
      if (keepOpen) arr.push(v.value);
      return { value: markIncomplete(arr), done: false };
    }
  }

  private string(): Parsed {
    this.i++; // opening quote
    let out = '';
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (c === '"') {
        this.i++;
        return { value: out, done: true };
      }
      if (c === '\\') {
        const esc = this.s[this.i + 1];
        if (esc === undefined) break; // dangling backslash
        if (esc === 'u') {
          const hex = this.s.slice(this.i + 2, this.i + 6);
          if (hex.length < 4) break; // partial \uXXXX
          out += String.fromCharCode(parseInt(hex, 16));
          this.i += 6;
          continue;
        }
        out += ESCAPES[esc] ?? esc;
        this.i += 2;
        continue;
      }
      out += c;
      this.i++;
    }
    this.i = this.s.length;
    return { value: out, done: false };
  }

  private number(): Parsed {
    const m = /^-?\d*(?:\.\d*)?(?:[eE][+-]?\d*)?/.exec(this.s.slice(this.i))!;
    this.i += m[0].length;
    // Running into the end of input means more digits may still be coming.
    if (this.i >= this.s.length) return { value: MISSING, done: false };
    const n = Number(m[0]);
    if (m[0] === '' || Number.isNaN(n)) this.fail();
    return { value: n, done: true };
  }

  private literal(): Parsed {
    const rest = this.s.slice(this.i);
    for (const [word, value] of LITERALS) {
      if (rest.startsWith(word)) {
        this.i += word.length;
        return { value, done: true };
      }
      if (word.startsWith(rest)) {
        this.i = this.s.length;
        return { value: MISSING, done: false };
      }
    }
    this.fail();
  }

  private ws() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }

  private fail(): never {
    throw new SyntaxError(`Unexpected character at position ${this.i} in partial JSON`);
  }
}

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
const LITERALS: Array<[string, unknown]> = [
  ['true', true],
  ['false', false],
  ['null', null],
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
