# Spike: what the Claude artifact runtime actually offers

**Question (Step 0 of the plan):** does a Claude Code artifact expose `window.claude.complete`
and `window.storage`, the APIs documented for claude.ai *chat* artifacts?

**Answer: no.** Settled on 2026-10-01 from the platform-served `window.claude` type
definitions (runtime contract **0.2.66**) that Claude Code ships with its
`artifact-capabilities` skill, not by guessing. `artifact-probe.html` next to this file lets a
viewer confirm the same thing empirically.

| The branch originally assumed | What Claude Code artifacts provide |
|---|---|
| `window.claude.complete(prompt) → Promise<string>` | Absent. `window.claude` carries only `use(name)`. `complete` belongs to chat artifacts, which "use a different, flat `window.claude`; neither `use()` nor these namespaces exist there". |
| No streaming | `const sample = await claude.use('sample')`; `sample(input, { onText({ text, delta }) })` streams. `text` is the whole answer so far, `delta` the new part. |
| History must be flattened into one prompt string | `input` may be a turns array `[{ role: 'user' \| 'assistant', content }]`, oldest first, starting and ending on `user`. No `system` role: standing instructions go in a leading `user` turn. ≤ 256 KiB in total. |
| No tool calling | `options.tools` exists (page functions with a JSON-schema argument), but each round is a separate paid request on the viewer's account and tool calls are never cached. |
| No image input | `options.images` (Blobs) where `sample.limits().images` is present. |
| `window.storage` async KV | Absent. The artifact has its own origin, so `localStorage` / `sessionStorage` / IndexedDB work, but may be empty or throw in private windows and previews. |
| — | The page must be **published with `capabilities: { sample: {} }`** or `use('sample')` resolves `null`. The first call in a view shows a consent dialog; a decline rejects `not_granted` for the rest of the view. `cache: false` is required for chat. Failures are plain `{ code, message, text? }` objects. `truncated: true` marks an answer cut off by the length limit. |

## Consequences for Chalk

- `src/transports/artifact.ts` talks to `claude.use('sample')`: the agent's `inlinePrompt` is the
  first user turn, the conversation follows as turns, deltas stream into the bubble, and the
  ```` ```chalk-plan ```` fence is withheld while streaming and extracted at the end.
- No storage shim: conversations persist in `localStorage` exactly as on the web build.
- The tool-based prompt stays off in the artifact: `sample` tools would make every lesson-plan
  turn two or three paid rounds and forbid caching. Possible follow-up, not needed.
- Publishing: `pnpm build:artifact`, then publish `dist-artifact/chalk.html` with the `sample`
  capability declared. Republish to the same URL for updates.
- The old fallback (npm bundle + CDN shell inside a chat artifact) is unnecessary.

## Live confirmation

- [ ] Opened the published Chalk artifact, allowed Claude on the first send, saw a reply stream
      and a `chalk-spec` render. _(date, who)_
