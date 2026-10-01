// The slice of the Claude Code artifact runtime (contract 0.2.66) that Chalk uses. Only
// `window.claude.use` is promised; the `sample` namespace arrives through it, or `null` when
// this view cannot run it (not published with `capabilities: {sample: {}}`, framed by a
// non-Claude host, or opened as a plain file). Absent everywhere else, so guard every access.
// Source of truth: the artifact-capabilities skill's sample.d.ts / claude.d.ts.

interface ArtifactSampleMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ArtifactSampleOptions {
  /** Called with the whole answer so far and the newly added part; never empty, never synchronous. */
  onText?: (update: { text: string; delta: string }) => void;
  signal?: AbortSignal;
  /** Must be false for chat, otherwise identical turns replay a stored answer for five minutes. */
  cache?: boolean;
  modelTier?: 'default' | 'complex' | 'quick';
}

interface ArtifactSampleResult {
  text: string;
  /** The answer hit the length or time limit and stops mid-thought. */
  truncated: boolean;
  modelTierApplied: 'default' | 'complex' | 'quick';
}

/** Rejection shape: a plain object, never an Error. `text` is what streamed before the failure. */
interface ArtifactSampleError {
  code: string;
  message: string;
  text?: string;
}

type ArtifactSampleFn = (input: string | ArtifactSampleMessage[], options?: ArtifactSampleOptions) => Promise<ArtifactSampleResult>;

interface Window {
  claude?: {
    use(name: 'sample'): Promise<ArtifactSampleFn | null>;
  };
}
