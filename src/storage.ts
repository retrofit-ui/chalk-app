// Synchronous key/value storage with the Web Storage surface the app already uses, with every
// call guarded: localStorage/sessionStorage throw in private windows, previews and sandboxed
// frames, and a Claude artifact (which has its own origin, so Web Storage works there) can hit
// any of those. Keeping the API sync means conversations.ts and anthropic.ts stay sync.

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEYS = {
  apiKey: 'chalk.api_key',
  conversations: 'chalk.conversations',
  activeId: 'chalk.activeConvId',
} as const;

/** Wraps a browser Storage, resolved on every call so init scripts/stubs that swap it are seen. */
export function webKV(storage: () => Storage): KV {
  return {
    getItem(key) {
      try { return storage().getItem(key); } catch { return null; }
    },
    setItem(key, value) {
      try { storage().setItem(key, value); } catch { /* unavailable or full — keep going without persistence */ }
    },
    removeItem(key) {
      try { storage().removeItem(key); } catch { /* as above */ }
    },
  };
}

export const local: KV = webKV(() => localStorage);
export const session: KV = webKV(() => sessionStorage);
