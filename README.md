## Usage

Those templates dependencies are maintained via [pnpm](https://pnpm.io) via `pnpm up -Lri`.

This is the reason you see a `pnpm-lock.yaml`. That being said, any package manager will work. This file can be safely be removed once you clone a template.

```bash
$ npm install # or pnpm install or yarn install
```

### Learn more on the [Solid Website](https://solidjs.com) and come chat with us on our [Discord](https://discord.com/invite/solidjs)

## Available Scripts

In the project directory, you can run:

### `npm run dev` or `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>

### `npm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

## Deployment

You can deploy the `dist` folder to any static host provider (netlify, surge, now, etc.)

## Claude artifact target

Besides the bring-your-own-API-key web build, Chalk can be published as a
[Claude artifact](https://code.claude.com/docs/en/artifacts): a page hosted on claude.ai
where each viewer signs in with their own Claude account and usage is billed to them. No
API key, no backend.

```bash
pnpm build:artifact   # → dist-artifact/chalk.html, one self-contained file (~4 MB)
```

Then, from an interactive Claude Code session that is logged in (`/login`):

> publish dist-artifact/chalk.html as an artifact titled Chalk

To push a new version to the same URL, give Claude the existing artifact URL along with
the request. Share the page from its header.

What is different inside the artifact (see `src/target.ts`, `src/transports/artifact.ts`):

- The model is reached through `window.claude.complete(prompt)` — no API key gate, no
  model selector, no token/cost display. There is no streaming, so the assistant bubble
  shows "… is thinking" until the whole reply arrives.
- The runtime has no tool calling, so agents use their `inlinePrompt`: spec docs are
  embedded in the prompt and the lesson plan comes back as a fenced ```` ```chalk-plan ````
  block that is extracted into the ⓘ panel.
- Drawing submission is disabled (no image input through `complete`).
- Conversations persist via the host's `window.storage` KV when present; otherwise they
  live in memory for the session. `localStorage` is unavailable in the sandbox.

`e2e/artifact.spec.ts` exercises the built file inside a sandboxed iframe with those host
APIs stubbed; it skips unless `dist-artifact/chalk.html` exists. CI builds the artifact,
asserts it is a single file under 16 MiB and uploads it as the `chalk-artifact` workflow
artifact.

Fallback if Claude Code artifacts turn out not to expose `window.claude.complete`
(check with `spike/artifact-probe.html`): build a single JS bundle, publish it to npm and
have a ~15-line HTML shell in a claude.ai chat artifact load it from jsDelivr. Not
implemented yet.

## This project was created with the [Solid CLI](https://github.com/solidjs-community/solid-cli)
