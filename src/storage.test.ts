import { describe, it, expect, vi, afterEach } from 'vitest';
import { webKV, artifactKV, STORAGE_KEYS } from './storage';

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

describe('artifactKV', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  function installStorage(initial: Record<string, string> = {}, opts: { wrapped?: boolean; withDelete?: boolean } = {}) {
    const data = { ...initial };
    const storage = {
      get: vi.fn(async (k: string) => {
        if (!(k in data)) return null;
        return opts.wrapped ? { value: data[k] } : data[k];
      }),
      set: vi.fn(async (k: string, v: string) => { data[k] = v; }),
      ...(opts.withDelete ? { delete: vi.fn(async (k: string) => { delete data[k]; }) } : {}),
    };
    (globalThis as { window?: unknown }).window = { storage };
    return { storage, data };
  }

  it('is an in-memory store before hydration', () => {
    const kv = artifactKV();
    expect(kv.getItem('k')).toBeNull();
    kv.setItem('k', 'v');
    expect(kv.getItem('k')).toBe('v');
    kv.removeItem('k');
    expect(kv.getItem('k')).toBeNull();
  });

  it('hydrate() loads every known key from window.storage, accepting plain-string values', async () => {
    installStorage({ [STORAGE_KEYS.conversations]: '{"c1":{}}', [STORAGE_KEYS.activeId]: 'c1' });
    const kv = artifactKV();
    await kv.hydrate();
    expect(kv.getItem(STORAGE_KEYS.conversations)).toBe('{"c1":{}}');
    expect(kv.getItem(STORAGE_KEYS.activeId)).toBe('c1');
  });

  it('hydrate() also accepts the { value } wrapper shape', async () => {
    installStorage({ [STORAGE_KEYS.conversations]: '{}' }, { wrapped: true });
    const kv = artifactKV();
    await kv.hydrate();
    expect(kv.getItem(STORAGE_KEYS.conversations)).toBe('{}');
  });

  it('hydrate() resolves and leaves the store empty when window.storage is absent', async () => {
    (globalThis as { window?: unknown }).window = {};
    const kv = artifactKV();
    await expect(kv.hydrate()).resolves.toBeUndefined();
    expect(kv.getItem(STORAGE_KEYS.conversations)).toBeNull();
  });

  it('hydrate() survives a rejecting window.storage.get', async () => {
    (globalThis as { window?: unknown }).window = { storage: { get: async () => { throw new Error('boom'); }, set: async () => {} } };
    const kv = artifactKV();
    await expect(kv.hydrate()).resolves.toBeUndefined();
  });

  it('setItem writes through to window.storage.set', async () => {
    const { storage } = installStorage();
    const kv = artifactKV();
    kv.setItem('k', 'v');
    expect(storage.set).toHaveBeenCalledWith('k', 'v');
  });

  it('removeItem uses window.storage.delete when available', async () => {
    const { storage } = installStorage({ k: 'v' }, { withDelete: true });
    const kv = artifactKV();
    kv.setItem('k', 'v');
    kv.removeItem('k');
    expect(storage.delete).toHaveBeenCalledWith('k');
  });

  it('removeItem falls back to writing an empty string when delete is missing, and hydrate treats that as absent', async () => {
    const k = STORAGE_KEYS.activeId;
    const { storage, data } = installStorage({ [k]: 'v' });
    const kv = artifactKV();
    kv.removeItem(k);
    expect(storage.set).toHaveBeenCalledWith(k, '');
    expect(data[k]).toBe('');
    const fresh = artifactKV();
    await fresh.hydrate();
    expect(fresh.getItem(k)).toBeNull();
  });

  it('a rejected write-through does not throw synchronously or poison later reads', async () => {
    (globalThis as { window?: unknown }).window = { storage: { get: async () => null, set: async () => { throw new Error('quota'); } } };
    const kv = artifactKV();
    expect(() => kv.setItem('k', 'v')).not.toThrow();
    await Promise.resolve();
    expect(kv.getItem('k')).toBe('v');
  });
});
