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
[Claude Code artifact](https://code.claude.com/docs/en/artifacts): a page hosted on claude.ai
where each viewer signs in with their own Claude account and usage is billed to them. No
API key, no backend.

```bash
pnpm build:artifact   # → dist-artifact/chalk.html, one self-contained file (~4 MB)
```

Then, from an interactive Claude Code session that is logged in (`/login`):

> publish dist-artifact/chalk.html as an artifact titled Chalk, with the `sample` capability

The `sample` capability (`capabilities: {sample: {}}` on the publish) is what lets the page
ask Claude; without it the app shows "Claude is not available in this view." To push a new
version to the same URL, give Claude the existing artifact URL along with the request. Share
the page from its header.

What is different inside the artifact (see `src/target.ts`, `src/transports/artifact.ts`,
and `spike/RESULTS.md` for what the runtime actually offers):

- The model is reached through the runtime's `claude.use('sample')`, on the viewer's own
  account: no API key gate, no model selector, no token/cost display. The viewer is asked to
  allow it on the first send of each visit. Replies stream; the bubble says "… is thinking"
  until the first text arrives (5–60 s on the default tier).
- The runtime has no system role and tool calls would cost an extra paid round each, so agents
  use their `inlinePrompt` as a leading user turn: spec docs are embedded, and the lesson plan
  comes back as a fenced ```` ```chalk-plan ```` block that is withheld while streaming and
  extracted into the ⓘ panel.
- Drawing submission is disabled (image input is a possible follow-up via `sample.limits()`).
- Conversations persist in the artifact's own `localStorage`, as on the web build.

`e2e/artifact.spec.ts` exercises the built file inside an iframe with `claude.use('sample')`
stubbed; it skips unless `dist-artifact/chalk.html` exists. CI builds the artifact, asserts it
is a single file under 16 MiB and uploads it as the `chalk-artifact` workflow artifact.
