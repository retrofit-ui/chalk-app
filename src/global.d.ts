// APIs injected by the Claude artifact runtime (claude.ai). Both are absent everywhere else,
// including the GitHub Pages build and local dev, so every access must be guarded.
interface Window {
  claude?: {
    /** One completion. The whole conversation must be serialized into the prompt string. */
    complete: (prompt: string) => Promise<string>;
  };
  storage?: {
    get: (key: string) => Promise<{ value: string } | string | null | undefined>;
    set: (key: string, value: string) => Promise<unknown>;
    delete?: (key: string) => Promise<unknown>;
  };
}
