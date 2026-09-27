import { IS_ARTIFACT } from './target';

// Synchronous key/value storage with the Web Storage surface the app already uses.
// On the web it is localStorage/sessionStorage; in a Claude artifact those throw (sandboxed
// iframe), so an in-memory map is hydrated once from the async window.storage API at boot
// and written through on every change. Keeping the API sync means conversations.ts and
// anthropic.ts don't have to become async.

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
      try { storage().setItem(key, value); } catch { /* sandboxed or full — keep going in memory-less mode */ }
    },
    removeItem(key) {
      try { storage().removeItem(key); } catch { /* as above */ }
    },
  };
}

export interface ArtifactKV extends KV {
  /** Loads every key in STORAGE_KEYS from window.storage. Never rejects. */
  hydrate(): Promise<void>;
}

function remoteStorage(): Window['storage'] | undefined {
  return typeof window !== 'undefined' ? window.storage : undefined;
}

export function artifactKV(): ArtifactKV {
  const mem = new Map<string, string>();
  return {
    getItem: (key) => mem.get(key) ?? null,
    setItem(key, value) {
      mem.set(key, value);
      remoteStorage()?.set(key, value).catch(() => {});
    },
    removeItem(key) {
      mem.delete(key);
      const remote = remoteStorage();
      if (!remote) return;
      // Not every runtime exposes delete; an empty string is treated as absent on hydrate.
      (remote.delete ? remote.delete(key) : remote.set(key, '')).catch(() => {});
    },
    async hydrate() {
      const remote = remoteStorage();
      if (!remote) return;
      await Promise.all(
        Object.values(STORAGE_KEYS).map(async (key) => {
          try {
            const raw = await remote.get(key);
            const value = typeof raw === 'string' ? raw : raw?.value;
            if (value) mem.set(key, value);
          } catch {
            // Unreadable key: start fresh rather than fail the boot.
          }
        }),
      );
    },
  };
}

// The instances the app uses. In the artifact build both "local" and "session" scopes collapse
// onto one hydrated map — the artifact has no notion of tabs.
const artifact = IS_ARTIFACT ? artifactKV() : undefined;

export const local: KV = artifact ?? webKV(() => localStorage);
export const session: KV = artifact ?? webKV(() => sessionStorage);

/** Call once before first render in the artifact build; a no-op on the web. */
export function hydrate(): Promise<void> {
  return artifact ? artifact.hydrate() : Promise.resolve();
}
