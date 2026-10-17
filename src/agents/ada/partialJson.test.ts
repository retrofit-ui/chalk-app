import { describe, it, expect } from 'vitest';
import { isIncomplete, parsePartialJson, PROSE_KEYS } from './partialJson';
import * as K from '../../../e2e/fixtures/kinds';

describe('parsePartialJson', () => {
  it('parses complete JSON exactly like JSON.parse, marking nothing incomplete', () => {
    const v = parsePartialJson('{"a":[1,-2.5e3,true,null],"b":{"c":"d\\n\\u00e9"}}') as Record<string, unknown>;
    expect(v).toEqual({ a: [1, -2500, true, null], b: { c: 'd\né' } });
    expect(isIncomplete(v)).toBe(false);
    expect(isIncomplete(v.a)).toBe(false);
  });

  it('returns undefined for empty or whitespace-only input', () => {
    expect(parsePartialJson('')).toBeUndefined();
    expect(parsePartialJson('  \n')).toBeUndefined();
  });

  it('keeps an open string so text types itself out', () => {
    const v = parsePartialJson('{"kind":"text","content":"Gradie');
    expect(v).toEqual({ kind: 'text', content: 'Gradie' });
    expect(isIncomplete(v)).toBe(true);
  });

  it('drops a half-typed code or reference string rather than showing a wrong value', () => {
    expect(parsePartialJson('{"kind":"chalk-gr')).toEqual({});
    expect(parsePartialJson('{"kind":"answerbox","identifier":"q1')).toEqual({ kind: 'answerbox' });
    expect(parsePartialJson('{"functions":[{"fn":"x^2"},{"fn":"sin(x')).toEqual({ functions: [{ fn: 'x^2' }] });
    expect(parsePartialJson('{"title":"T","fn":"sin(x')).toEqual({ title: 'T' });
    expect(parsePartialJson('{"edges":[{"from":"q0","to":"q')).toEqual({ edges: [] });
    expect(parsePartialJson('{"start":"q')).toEqual({});
  });

  it('treats unknown string keys as code: withheld until closed', () => {
    expect(parsePartialJson('{"someNewField":"abc')).toEqual({});
    expect(parsePartialJson('{"someNewField":"abc"')).toEqual({ someNewField: 'abc' });
  });

  it('types out every prose key', () => {
    for (const key of ['label', 'title', 'text', 'content', 'header', 'description', 'prompt', 'note', 'placeholder', 'caption']) {
      expect(parsePartialJson(`{"${key}":"Hel`)).toEqual({ [key]: 'Hel' });
    }
  });

  it('drops an unterminated number, since more digits may follow', () => {
    expect(parsePartialJson('{"gap":12')).toEqual({});
    expect(parsePartialJson('{"gap":12,')).toEqual({ gap: 12 });
    expect(parsePartialJson('{"xs":[1,2,3')).toEqual({ xs: [1, 2] });
  });

  it('drops an unterminated literal', () => {
    expect(parsePartialJson('{"wrap":tr')).toEqual({});
    expect(parsePartialJson('{"wrap":true}')).toEqual({ wrap: true });
  });

  it('drops a key that has no value yet', () => {
    expect(parsePartialJson('{"a":1,"label":')).toEqual({ a: 1 });
    expect(parsePartialJson('{"a":1,"lab')).toEqual({ a: 1 });
  });

  it('drops an open trailing array element (a half-written point or row)', () => {
    expect(parsePartialJson('{"points":[[1,2],[3,')).toEqual({ points: [[1, 2]] });
    expect(parsePartialJson('{"edges":[{"from":"a","to":"b"},{"from":"a"')).toEqual({
      edges: [{ from: 'a', to: 'b' }],
    });
    expect(parsePartialJson('{"labels":["x","y')).toEqual({ labels: ['x'] });
  });

  it('keeps an open object in a children array, marked incomplete', () => {
    const v = parsePartialJson(
      '{"kind":"flex","children":[{"kind":"text","content":"done"},{"kind":"chalk-graph","title":"Par',
    ) as { children: object[] };
    expect(v).toEqual({
      kind: 'flex',
      children: [{ kind: 'text', content: 'done' }, { kind: 'chalk-graph', title: 'Par' }],
    });
    expect(isIncomplete(v)).toBe(true);
    expect(isIncomplete(v.children)).toBe(true);
    expect(isIncomplete(v.children[0])).toBe(false);
    expect(isIncomplete(v.children[1])).toBe(true);
  });

  it('cuts a string at a dangling escape instead of guessing', () => {
    expect(parsePartialJson('{"text":"a\\')).toEqual({ text: 'a' });
    expect(parsePartialJson('{"text":"a\\u00')).toEqual({ text: 'a' });
  });

  it('ignores trailing text after a complete value (e.g. a half-arrived closing fence)', () => {
    expect(parsePartialJson('{"a":1}\n``')).toEqual({ a: 1 });
  });

  it('throws on malformed (not merely truncated) input', () => {
    expect(() => parsePartialJson('{a:1}')).toThrow(SyntaxError);
    expect(() => parsePartialJson('{"a":nope}')).toThrow(SyntaxError);
  });
});

// The anti-flicker guarantee: every prefix of a spec parses to a "subset" of
// the final value. Nothing shown mid-stream is ever replaced by a different
// value; it only grows. And anything not marked incomplete is already final.
describe('every prefix of a real spec is a growing subset of the final value', () => {
  const nested = {
    kind: 'flex',
    direction: 'row',
    children: [K.text, { kind: 'card', header: 'Inner "quoted" \\ é', children: [K.graph, K.matrix] }, K.computeGraph],
  };
  const fixtures: Record<string, unknown> = { ...K, nested };

  for (const [name, fixture] of Object.entries(fixtures)) {
    if (typeof fixture !== 'object' || fixture === null || Array.isArray(fixture)) continue;
    for (const [style, json] of [
      ['compact', JSON.stringify(fixture)],
      ['pretty', JSON.stringify(fixture, null, 2)],
    ] as const) {
      it(`${name} (${style})`, () => {
        for (let n = 0; n <= json.length; n++) {
          const partial = parsePartialJson(json.slice(0, n));
          assertSubset(partial, fixture, `prefix ${n}: ${json.slice(Math.max(0, n - 20), n)}`);
        }
        expect(parsePartialJson(json)).toEqual(fixture);
      });
    }
  }
});

function assertSubset(partial: unknown, final: unknown, where: string, key?: string): void {
  if (partial === undefined) return;
  if (typeof partial === 'string') {
    expect(typeof final, where).toBe('string');
    if (key === undefined || !PROSE_KEYS.has(key)) expect(partial, `${where} [${key}]`).toBe(final);
    else expect((final as string).startsWith(partial), `${where} ${JSON.stringify(partial)}`).toBe(true);
    return;
  }
  if (typeof partial !== 'object' || partial === null) {
    expect(partial, where).toBe(final);
    return;
  }
  if (!isIncomplete(partial)) {
    expect(partial, where).toEqual(final);
    return;
  }
  if (Array.isArray(partial)) {
    expect(Array.isArray(final), where).toBe(true);
    const f = final as unknown[];
    expect(partial.length, where).toBeLessThanOrEqual(f.length);
    partial.forEach((el, i) => assertSubset(el, f[i], where));
    return;
  }
  expect(typeof final === 'object' && final !== null && !Array.isArray(final), where).toBe(true);
  for (const [k, v] of Object.entries(partial)) {
    expect(k in (final as object), `${where} unexpected key ${k}`).toBe(true);
    assertSubset(v, (final as Record<string, unknown>)[k], where, k);
  }
}
