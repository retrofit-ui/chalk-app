import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { ARTIFACT_FILE, mountArtifact, harnessEvents } from './helpers/artifactHarness';
import { conversation, userMessage, assistantMessage, specFence, CONV_STORAGE, ACTIVE_ID_KEY } from './helpers/seed';
import * as K from './fixtures/kinds';

// Layer 3: the published single-file build, inside a sandboxed iframe, against a stubbed
// window.claude / window.storage runtime. Requires `pnpm build:artifact` to have run.

test.skip(!fs.existsSync(ARTIFACT_FILE), `${ARTIFACT_FILE} missing — run pnpm build:artifact first`);

const REPLY =
  'Here is the matrix:\n' +
  specFence(K.matrix) +
  '\n```chalk-plan\n# Matrices\n1. Shape\n2. Multiplication\n```\n\nWhat do you notice about the rows?';

test.describe('artifact build in a sandboxed iframe', () => {
  test('boots without a key gate or model selector even though Web Storage throws', async ({ page }) => {
    const app = await mountArtifact(page, { replies: [REPLY] });

    await expect(app.getByTestId('composer-input')).toBeVisible();
    await expect(app.getByTestId('keygate-input')).toHaveCount(0);
    await expect(app.locator('option[value="claude-sonnet-4-6"]')).toHaveCount(0);
    // The agent picker is still there.
    await expect(app.locator('option[value="ada"]')).toHaveCount(1);

    const { storageProbe } = await harnessEvents(page);
    expect(storageProbe).toEqual({ localStorage: 'throws', sessionStorage: 'throws' });
  });

  test('a turn goes through window.claude.complete, renders the spec and files the plan', async ({ page }) => {
    const app = await mountArtifact(page, { replies: [REPLY], replyDelayMs: 600 });

    await app.getByTestId('composer-input').fill('show me a matrix');
    await app.getByTestId('composer-send').click();

    // No streaming in this runtime: the pending bubble must say something.
    await expect(app.getByTestId('thinking')).toBeVisible();

    await expect(app.getByText('Here is the matrix:')).toBeVisible();
    await expect(app.locator('[data-kind="chalk-matrix"] .font-mono')).toHaveCount(6);
    await expect(app.getByText('What do you notice about the rows?')).toBeVisible();
    // The plan is extracted into the side panel, not rendered inline.
    await expect(app.getByTestId('message').getByText('# Matrices')).toHaveCount(0);
    await expect(app.locator('header').getByTitle('View lesson plan')).toHaveText('ⓘ');
    await app.locator('header').getByTitle('View lesson plan').click();
    await expect(app.getByText('Multiplication')).toBeVisible();

    const { prompts } = await harnessEvents(page);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('You are Ada');
    expect(prompts[0]).toContain('```chalk-plan');        // inline prompt, not the tool prompt
    expect(prompts[0]).not.toContain('set_lesson_plan');
    expect(prompts[0]).toContain('### User\nshow me a matrix');
    expect(prompts[0].trimEnd().endsWith('### Assistant')).toBe(true);
  });

  test('the second turn replays the first exchange in the prompt', async ({ page }) => {
    const app = await mountArtifact(page, { replies: ['First answer.', 'Second answer.'] });

    await app.getByTestId('composer-input').fill('one');
    await app.getByTestId('composer-send').click();
    await expect(app.getByText('First answer.')).toBeVisible();

    await app.getByTestId('composer-input').fill('two');
    await app.getByTestId('composer-send').click();
    await expect(app.getByText('Second answer.')).toBeVisible();

    const { prompts } = await harnessEvents(page);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('### User\none\n\n### Assistant\nFirst answer.\n\n### User\ntwo');
  });

  test('conversations are written through to window.storage', async ({ page }) => {
    const app = await mountArtifact(page, { replies: ['Noted.'] });

    await app.getByTestId('composer-input').fill('remember this');
    await app.getByTestId('composer-send').click();
    await expect(app.getByText('Noted.')).toBeVisible();

    const { storageWrites } = await harnessEvents(page);
    const convWrites = storageWrites.filter((w) => w.key === CONV_STORAGE);
    expect(convWrites.length).toBeGreaterThan(0);
    const last = JSON.parse(convWrites[convWrites.length - 1].value) as Record<string, { messages: Array<{ content: unknown }> }>;
    const [conv] = Object.values(last);
    expect(conv.messages.map((m) => m.content)).toEqual(['remember this', 'Noted.']);
    expect(storageWrites.some((w) => w.key === ACTIVE_ID_KEY)).toBe(true);
  });

  test('a conversation already in window.storage is shown on boot', async ({ page }) => {
    const conv = conversation('seeded', [userMessage('earlier question'), assistantMessage('earlier answer')], {
      title: 'Seeded chat',
    });
    const app = await mountArtifact(page, {
      replies: ['x'],
      storage: {
        [CONV_STORAGE]: JSON.stringify({ [conv.id]: conv }),
        [ACTIVE_ID_KEY]: conv.id,
      },
    });

    await expect(app.getByText('earlier question')).toBeVisible();
    await expect(app.getByText('earlier answer')).toBeVisible();
    await expect(app.locator('header').getByText('Seeded chat')).toBeVisible();
  });

  test('still works, in memory only, when the host has no window.storage', async ({ page }) => {
    const app = await mountArtifact(page, { replies: ['Fine without storage.'], withoutStorage: true });

    await app.getByTestId('composer-input').fill('hello');
    await app.getByTestId('composer-send').click();
    await expect(app.getByText('Fine without storage.')).toBeVisible();
  });
});
