import { test, expect } from '@playwright/test';
import { seedApp } from './helpers/seed';
import { holdAnthropicStream } from './helpers/anthropicSse';
import * as K from './fixtures/kinds';

// What a reply looks like *while* a chalk-spec is still streaming in: the
// partial spec renders progressively, unknown parts are placeholders, and
// finished parts are neither re-drawn nor flagged as truncated.

const flex = { kind: 'flex', direction: 'row', children: [K.matrix, K.graph3d] };
const reply = 'Look at these:\n```chalk-spec\n' + JSON.stringify(flex) + '\n```\nThat is all.';
const secondChildStart = reply.indexOf('{"kind":"chalk-graph3d"');

async function startStreaming(page: import('@playwright/test').Page) {
  await seedApp(page);
  const stream = await holdAnthropicStream(page);
  await page.goto('/');
  await page.getByTestId('composer-input').fill('show me');
  await page.getByTestId('composer-send').click();
  await stream.opened();
  return stream;
}

test.describe('a chalk-spec that is still streaming', () => {
  test('shows the flex, its finished child, and a placeholder for the unfinished one', async ({ page }) => {
    const stream = await startStreaming(page);

    // Stop just after the second child opens: `{"ki` — its kind is unknown.
    await stream.sendText(reply.slice(0, secondChildStart + 4));

    const flexNode = page.locator('[data-kind="flex"]');
    await expect(flexNode).toHaveCount(1);
    await expect(flexNode.locator('[data-kind="chalk-matrix"] .font-mono')).toHaveCount(6);
    await expect(flexNode.getByTestId('spec-placeholder')).toHaveCount(1);
    await expect(page.getByText('Truncated')).toHaveCount(0);

    // Once the kind arrives, the placeholder names it (or the plot is already drawing).
    await stream.sendText(reply.slice(secondChildStart + 4, secondChildStart + 24));
    await expect(
      flexNode.locator('[data-placeholder-kind="chalk-graph3d"], [data-kind="chalk-graph3d"]'),
    ).toHaveCount(1);

    await stream.sendText(reply.slice(secondChildStart + 24));
    await stream.finish();
    await expect(page.getByText('That is all.')).toBeVisible();
    await expect(page.getByTestId('spec-placeholder')).toHaveCount(0);
    await expect(flexNode.locator('[data-kind="chalk-graph3d"] canvas')).toHaveCount(1);
    await expect(page.getByText('Truncated')).toHaveCount(0);
  });

  test('finished components are not remounted while the rest of the reply streams', async ({ page }) => {
    const stream = await startStreaming(page);
    const fenceEnd = reply.indexOf('\n```\n') + 5;

    await stream.sendText(reply.slice(0, fenceEnd));
    const canvas = page.locator('[data-kind="chalk-graph3d"] canvas');
    await expect(canvas).toHaveCount(1);
    await canvas.evaluate((el) => ((el as unknown as { __marker: boolean }).__marker = true));
    await page
      .locator('[data-kind="chalk-matrix"]')
      .evaluate((el) => ((el as unknown as { __marker: boolean }).__marker = true));

    await stream.sendText(reply.slice(fenceEnd), 3);
    await stream.finish();
    await expect(page.getByText('That is all.')).toBeVisible();

    expect(await canvas.evaluate((el) => (el as unknown as { __marker?: boolean }).__marker)).toBe(true);
    expect(
      await page
        .locator('[data-kind="chalk-matrix"]')
        .evaluate((el) => (el as unknown as { __marker?: boolean }).__marker),
    ).toBe(true);
  });

  test('an answerbox Submit appears only once the reply has finished', async ({ page }) => {
    const stream = await startStreaming(page);
    const text = '```chalk-spec\n' + JSON.stringify(K.answerbox) + '\n```\nYour turn.';

    await stream.sendText(text);
    await expect(page.getByTestId('answerbox-input')).toBeVisible();
    await expect(page.getByTestId('answerbox-submit')).toHaveCount(0);

    await stream.finish();
    await expect(page.getByTestId('answerbox-submit')).toBeVisible();
  });
});
