import fs from 'node:fs';
import path from 'node:path';
import type { FrameLocator, Page } from '@playwright/test';

// Loads dist-artifact/chalk.html inside an iframe with window.claude stubbed the way the Claude
// Code artifact runtime (contract 0.2.66) provides it: only `use(name)`, resolving the `sample`
// function asynchronously. The stub reports every sample() call back to the parent page via
// postMessage so a test can inspect the turns and options the app sent.
//
// Sandbox modes: 'same-origin' (default) models the artifact's own origin, where Web Storage
// works; 'opaque' models a host that gives the frame no origin, where Web Storage throws.

export const ARTIFACT_FILE = path.resolve(import.meta.dirname, '../../dist-artifact/chalk.html');
export const HARNESS_URL = '/__artifact-harness/';
const FRAME_URL = '/__artifact-harness/chalk.html';

export type SampleRejection = { code: string; message: string; text?: string };

export type HarnessOptions = {
  /** What sample() answers, per call, in order. The last one repeats. */
  replies: string[];
  /** Delay before the first delta and between deltas, so pending/streaming states can be observed. */
  replyDelayMs?: number;
  /** How many onText deltas each reply is split into. */
  chunks?: number;
  /** Make every sample() call reject with this instead of answering. */
  reject?: SampleRejection;
  /** Resolve with truncated: true. */
  truncated?: boolean;
  sandbox?: 'same-origin' | 'opaque';
};

export type SampleCall = {
  input: string | Array<{ role: 'user' | 'assistant'; content: string }>;
  options: { cache?: unknown; hasOnText: boolean };
};

export type HarnessEvents = {
  calls: SampleCall[];
  storageProbe: { localStorage: string; sessionStorage: string } | null;
};

function runtimeStub(opts: HarnessOptions): string {
  // Serialized into the iframe; runs before the app's module script.
  return `
    (function () {
      var replies = ${JSON.stringify(opts.replies)};
      var delay = ${opts.replyDelayMs ?? 0};
      var chunks = ${opts.chunks ?? 3};
      var reject = ${JSON.stringify(opts.reject ?? null)};
      var truncated = ${opts.truncated ? 'true' : 'false'};
      var calls = 0;
      var report = function (type, payload) { parent.postMessage({ source: 'chalk-harness', type: type, payload: payload }, '*'); };
      var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

      var probe = function (name) { try { window[name].setItem('probe', '1'); return 'works'; } catch (e) { return 'throws'; } };
      report('storageProbe', { localStorage: probe('localStorage'), sessionStorage: probe('sessionStorage') });

      var sample = async function (input, options) {
        options = options || {};
        report('call', { input: input, options: { cache: options.cache, hasOnText: typeof options.onText === 'function' } });
        await sleep(delay);
        if (reject) throw reject;
        var reply = replies[Math.min(calls++, replies.length - 1)];
        var size = Math.max(1, Math.ceil(reply.length / chunks));
        var text = '';
        for (var i = 0; i < reply.length; i += size) {
          if (i > 0) await sleep(delay);
          var delta = reply.slice(i, i + size);
          text += delta;
          if (options.onText) options.onText({ text: text, delta: delta });
        }
        return { text: text, truncated: truncated, modelTierApplied: 'default' };
      };
      sample.limits = function () { return Promise.resolve({ maxPromptBytes: 262144 }); };

      window.claude = {
        use: function (name) {
          // The real runtime resolves later, never synchronously.
          return new Promise(function (resolve) { setTimeout(function () { resolve(name === 'sample' ? sample : null); }, 0); });
        },
      };
    })();
  `;
}

function harnessPage(sandbox: HarnessOptions['sandbox']): string {
  const attr = sandbox === 'opaque' ? 'allow-scripts' : 'allow-scripts allow-same-origin';
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>artifact harness</title>
<script>
  window.__events = { calls: [], storageProbe: null };
  addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.source !== 'chalk-harness') return;
    if (m.type === 'call') window.__events.calls.push(m.payload);
    else if (m.type === 'storageProbe') window.__events.storageProbe = m.payload;
  });
</script></head>
<body style="margin:0">
  <iframe id="artifact" sandbox="${attr}" src="${FRAME_URL}" style="border:0;width:100vw;height:100vh"></iframe>
</body></html>`;
}

// The published artifact is wrapped in the platform's document skeleton; this mirrors it
// (charset, viewport, the small reset) and adds the runtime stub before the page content.
function wrapLikePublish(fragment: string, stub: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif;background:#fafaf9}img{max-width:100%}[hidden]{display:none!important}</style><script>${stub}</script></head><body>${fragment}</body></html>`;
}

export async function mountArtifact(page: Page, opts: HarnessOptions): Promise<FrameLocator> {
  const fragment = fs.readFileSync(ARTIFACT_FILE, 'utf8');
  if (!fragment.trimStart().startsWith('<title>')) throw new Error('chalk.html should be page content starting with <title>, without a document skeleton');
  const body = wrapLikePublish(fragment, runtimeStub(opts));

  await page.route(`**${FRAME_URL}`, (route) => route.fulfill({ contentType: 'text/html', body }));
  await page.route(`**${HARNESS_URL}`, (route) => route.fulfill({ contentType: 'text/html', body: harnessPage(opts.sandbox) }));
  await page.goto(HARNESS_URL);
  return page.frameLocator('#artifact');
}

export function harnessEvents(page: Page): Promise<HarnessEvents> {
  return page.evaluate(() => (window as unknown as { __events: HarnessEvents }).__events);
}
