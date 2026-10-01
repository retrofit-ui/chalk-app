import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { ARTIFACT_FILE, mountArtifact, harnessEvents } from './helpers/artifactHarness';
import { specFence } from './helpers/seed';
import * as K from './fixtures/kinds';

// Layer 3: the published single-file build inside an iframe, against a stubbed
// claude.use('sample') runtime. Requires `pnpm build:artifact` to have run.

test.skip(!fs.existsSync(ARTIFACT_FILE), `${ARTIFACT_FILE} missing — run pnpm build:artifact first`);

const REPLY =
  'Here is the matrix:\n' +
  specFence(K.matrix) +
  '\n```chalk-plan\n# Matrices\n1. Shape\n2. Multiplication\n```\n\nWhat do you notice about the rows?';

async function send(app: Awaited<ReturnType<typeof mountArtifact>>, text: string) {
  await app.getByTestId('composer-input').fill(text);
  await app.getByTestId('composer-send').click();
}

test.describe('artifact build against the sample runtime', () => {
  test('boots without a key gate or model selector, with Web Storage available on its own origin', async ({ page }) => {
    const app = await mountArtifact(page, { replies: [REPLY] });

    await expect(app.getByTestId('composer-input')).toBeVisible();
    await expect(app.getByTestId('keygate-input')).toHaveCount(0);
    await expect(app.locator('option[value="claude-sonnet-4-6"]')).toHaveCount(0);
    await expect(app.locator('option[value="ada"]')).toHaveCount(1);

    const { storageProbe } = await harnessEvents(page);
    expect(storageProbe).toEqual({ localStorage: 'works', sessionStorage: 'works' });
  });

  test('a turn streams through sample(): thinking, then partial text, then the spec and the plan', async ({ page }) => {
    const app = await mountArtifact(page, { replies: [REPLY], replyDelayMs: 500, chunks: 4 });

    await send(app, 'show me a matrix');
    await expect(app.getByTestId('thinking')).toBeVisible();

    // Streaming: the opening words land before the closing question does.
    await expect(app.getByText('Here is the matrix:')).toBeVisible();
    await expect(app.getByText('What do you notice about the rows?')).toHaveCount(0);

    await expect(app.getByText('What do you notice about the rows?')).toBeVisible();
    await expect(app.locator('[data-kind="chalk-matrix"] .font-mono')).toHaveCount(6);
    // The plan went to the side panel, not the bubble.
    await expect(app.getByTestId('message').getByText('chalk-plan')).toHaveCount(0);
    await expect(app.getByTestId('message').getByText('# Matrices')).toHaveCount(0);
    await expect(app.locator('header').getByTitle('View lesson plan')).toHaveText('ⓘ');
    await app.locator('header').getByTitle('View lesson plan').click();
    await expect(app.getByText('Multiplication')).toBeVisible();

    const { calls } = await harnessEvents(page);
    expect(calls).toHaveLength(1);
    const turns = calls[0].input;
    expect(Array.isArray(turns)).toBe(true);
    if (!Array.isArray(turns)) return;
    // Inline prompt as the leading user turn: no system role, no tool-based instructions.
    expect(turns[0].role).toBe('user');
    expect(turns[0].content).toContain('You are Ada');
    expect(turns[0].content).toContain('```chalk-plan');
    expect(turns[0].content).not.toContain('set_lesson_plan');
    expect(turns[turns.length - 1]).toEqual({ role: 'user', content: 'show me a matrix' });
    expect(calls[0].options).toEqual({ cache: false, hasOnText: true });
  });

  test('the second turn replays the first exchange as turns', async ({ page }) => {
    const app = await mountArtifact(page, { replies: ['First answer.', 'Second answer.'] });

    await send(app, 'one');
    await expect(app.getByText('First answer.')).toBeVisible();
    await send(app, 'two');
    await expect(app.getByText('Second answer.')).toBeVisible();

    const { calls } = await harnessEvents(page);
    expect(calls).toHaveLength(2);
    expect(calls[1].input).toEqual([
      expect.objectContaining({ role: 'user' }), // instructions
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'First answer.' },
      { role: 'user', content: 'two' },
    ]);
  });

  test('a reload restores the conversation from localStorage', async ({ page }) => {
    const app = await mountArtifact(page, { replies: ['Noted.'] });
    await send(app, 'remember this');
    await expect(app.getByText('Noted.')).toBeVisible();

    await page.reload();
    const again = page.frameLocator('#artifact');
    await expect(again.getByTestId('message').getByText('remember this')).toBeVisible();
    await expect(again.getByTestId('message').getByText('Noted.')).toBeVisible();
    expect((await harnessEvents(page)).calls).toHaveLength(0);
  });

  test('still completes a turn when the frame has no origin and Web Storage throws', async ({ page }) => {
    const app = await mountArtifact(page, { replies: ['Fine without storage.'], sandbox: 'opaque' });
    expect((await harnessEvents(page)).storageProbe).toEqual({ localStorage: 'throws', sessionStorage: 'throws' });

    await send(app, 'hello');
    await expect(app.getByText('Fine without storage.')).toBeVisible();
  });

  test('a declined consent shows a readable error and keeps the composer usable', async ({ page }) => {
    const app = await mountArtifact(page, { replies: [], reject: { code: 'not_granted', message: 'dev text' } });
    await send(app, 'hello');
    await expect(app.getByText('You have not allowed this artifact to use Claude', { exact: false })).toBeVisible();
    await expect(app.getByTestId('composer-input')).toBeEnabled();
  });

  test('a truncated answer carries the truncated badge', async ({ page }) => {
    const app = await mountArtifact(page, { replies: ['Half an ans'], truncated: true });
    await send(app, 'hello');
    await expect(app.getByText('Half an ans')).toBeVisible();
    await expect(app.getByText('⚠ truncated')).toBeVisible();
  });
});
