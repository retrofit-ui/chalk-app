import { describe, it, expect, vi } from 'vitest';
import { webKV } from './storage';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: vi.fn((k: string) => data[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { data[k] = v; }),
    removeItem: vi.fn((k: string) => { delete data[k]; }),
  } as unknown as Storage & { data: Record<string, string> };
}

describe('webKV', () => {
  it('delegates getItem/setItem/removeItem to the Storage returned by the accessor, per call', () => {
    let current = fakeStorage({ a: '1' });
    const kv = webKV(() => current);
    expect(kv.getItem('a')).toBe('1');
    kv.setItem('b', '2');
    expect(current.data.b).toBe('2');
    kv.removeItem('a');
    expect(current.data.a).toBeUndefined();
    // Swapping the backing store (as an e2e init script effectively does) is picked up immediately.
    current = fakeStorage({ a: 'later' });
    expect(kv.getItem('a')).toBe('later');
  });

  it('treats a throwing Storage accessor (sandboxed iframe) as empty and swallows writes', () => {
    const kv = webKV(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(kv.getItem('x')).toBeNull();
    expect(() => kv.setItem('x', '1')).not.toThrow();
    expect(() => kv.removeItem('x')).not.toThrow();
  });
});

