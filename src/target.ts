// Which deployment this bundle is for. Set at build time via VITE_TARGET (see .env.artifact,
// picked up by `vite build --mode artifact`); everything else — dev, tests, GitHub Pages — is 'web'.
export type Target = 'web' | 'artifact';

export const TARGET: Target = import.meta.env.VITE_TARGET === 'artifact' ? 'artifact' : 'web';

/** True inside the Claude-artifact build: no API key, no SDK, window.claude/window.storage instead. */
export const IS_ARTIFACT = TARGET === 'artifact';
