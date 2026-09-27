import fs from 'node:fs';
import path from 'node:path';
import type { FrameLocator, Page } from '@playwright/test';

// Loads dist-artifact/chalk.html inside a sandboxed iframe (opaque origin: localStorage and
// sessionStorage throw, exactly like the claude.ai artifact host) with window.claude and
// window.storage stubbed the way the real runtime injects them. The stubs report back to
// the parent page via postMessage so the test can inspect prompts and storage writes.

export const ARTIFACT_FILE = path.resolve(import.meta.dirname, '../../dist-artifact/chalk.html');
export const HARNESS_URL = '/__artifact-harness/';
const FRAME_URL = '/__artifact-harness/chalk.html';

export type HarnessOptions = {
  /** What window.claude.complete resolves with, per call, in order. The last one repeats. */
  replies: string[];
  /** Delay before each reply resolves — long enough for the UI's pending state to be observed. */
  replyDelayMs?: number;
  /** Initial window.storage contents. */
  storage?: Record<string, string>;
  /** Leave window.storage undefined to model a host without the KV API. */
  withoutStorage?: boolean;
};

export type HarnessEvents = {
  prompts: string[];
  storageWrites: Array<{ key: string; value: string }>;
  storageProbe: { localStorage: string; sessionStorage: string } | null;
};

function runtimeStub(opts: HarnessOptions): string {
  // Serialized into the iframe; runs before the app's module script.
  return `
    (function () {
      var replies = ${JSON.stringify(opts.replies)};
      var delay = ${opts.replyDelayMs ?? 0};
      var calls = 0;
      var report = function (type, payload) { parent.postMessage({ source: 'chalk-harness', type: type, payload: payload }, '*'); };

      var probe = function (name) { try { window[name].setItem('probe', '1'); return 'works'; } catch (e) { return 'throws'; } };
      report('storageProbe', { localStorage: probe('localStorage'), sessionStorage: probe('sessionStorage') });

      window.claude = {
        complete: function (prompt) {
          report('prompt', prompt);
          var reply = replies[Math.min(calls++, replies.length - 1)];
          return new Promise(function (resolve) { setTimeout(function () { resolve(reply); }, delay); });
        },
      };

      ${opts.withoutStorage ? '' : `
      var kv = ${JSON.stringify(opts.storage ?? {})};
      window.storage = {
        get: function (key) { return Promise.resolve(key in kv ? { value: kv[key] } : null); },
        set: function (key, value) { kv[key] = value; report('storageWrite', { key: key, value: value }); return Promise.resolve({ ok: true }); },
      };`}
    })();
  `;
}

const HARNESS_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>artifact harness</title>
<script>
  window.__events = { prompts: [], storageWrites: [], storageProbe: null };
  addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.source !== 'chalk-harness') return;
    if (m.type === 'prompt') window.__events.prompts.push(m.payload);
    else if (m.type === 'storageWrite') window.__events.storageWrites.push(m.payload);
    else if (m.type === 'storageProbe') window.__events.storageProbe = m.payload;
  });
</script></head>
<body style="margin:0">
  <iframe id="artifact" sandbox="allow-scripts" src="${FRAME_URL}" style="border:0;width:100vw;height:100vh"></iframe>
</body></html>`;

export async function mountArtifact(page: Page, opts: HarnessOptions): Promise<FrameLocator> {
  const html = fs.readFileSync(ARTIFACT_FILE, 'utf8');
  const body = html.replace('<head>', `<head><script>${runtimeStub(opts)}</script>`);
  if (body === html) throw new Error('chalk.html has no <head> to inject the runtime stub into');

  await page.route(`**${FRAME_URL}`, (route) => route.fulfill({ contentType: 'text/html', body }));
  await page.route(`**${HARNESS_URL}`, (route) => route.fulfill({ contentType: 'text/html', body: HARNESS_PAGE }));
  await page.goto(HARNESS_URL);
  return page.frameLocator('#artifact');
}

export function harnessEvents(page: Page): Promise<HarnessEvents> {
  return page.evaluate(() => (window as unknown as { __events: HarnessEvents }).__events);
}
