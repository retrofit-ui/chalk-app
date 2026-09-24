import { test, expect, type Page } from '@playwright/test';
import { seedSpec, seedApp, conversation, userMessage, assistantMessage } from './helpers/seed';
import * as K from './fixtures/kinds';

// Layer 1: a seeded conversation containing one ```chalk-spec block per
// test, rendered with zero network. Each test asserts the kind was dispatched
// (`[data-kind]`) AND one property that only the correct renderer produces.

async function openSpec(page: Page, spec: unknown) {
  await seedSpec(page, spec);
  await page.goto('/');
  return page.locator(`[data-kind="${(spec as { kind: string }).kind}"]`);
}

test.describe('bespoke chalk-* kinds', () => {
  test('chalk-graph renders a function-plot svg', async ({ page }) => {
    const node = await openSpec(page, K.graph);
    await expect(node).toHaveCount(1);
    await expect(node).toContainText('Parabola fixture');
    await expect(node.locator('.chalk-plot svg')).toHaveCount(1);
  });

  test('chalk-draw renders a canvas', async ({ page }) => {
    const node = await openSpec(page, K.draw);
    await expect(node).toHaveCount(1);
    await expect(node).toContainText('Draw a line through the origin');
    await expect(node.locator('canvas')).toHaveCount(1);
  });

  test('chalk-sets renders one ellipse per set', async ({ page }) => {
    const node = await openSpec(page, K.sets);
    await expect(node).toHaveCount(1);
    await expect(node.locator('svg ellipse')).toHaveCount(K.sets.sets.length);
  });

  test('chalk-graph3d mounts a WebGL canvas', async ({ page }) => {
    const node = await openSpec(page, K.graph3d);
    await expect(node).toHaveCount(1);
    await expect(node.locator('canvas')).toHaveCount(1);
  });

  test('chalk-vectors renders one arrow per vector', async ({ page }) => {
    const node = await openSpec(page, K.vectors);
    await expect(node).toHaveCount(1);
    await expect(node.locator('svg line[marker-end]')).toHaveCount(K.vectors.vectors.length);
  });

  test('chalk-matrix renders rows×cols cells with formatted values', async ({ page }) => {
    const node = await openSpec(page, K.matrix);
    await expect(node).toHaveCount(1);
    const cells = node.locator('.font-mono');
    await expect(cells).toHaveCount(2 * 3);
    await expect(cells).toHaveText(['1', '2', '3', '4', '5', '6']);
  });

  test('chalk-matmul computes and renders the product', async ({ page }) => {
    const node = await openSpec(page, K.matmul);
    await expect(node).toHaveCount(1);
    // A (4) + B (4) + C (4) cells; C is the last grid.
    const grids = node.locator('.grid');
    await expect(grids).toHaveCount(3);
    await expect(grids.nth(2).locator('.font-mono')).toHaveText(K.matmulResult.flat().map(String));
  });

  test('chalk-compute-graph renders every node and edge', async ({ page }) => {
    const node = await openSpec(page, K.computeGraph);
    await expect(node).toHaveCount(1);
    for (const n of K.computeGraph.nodes) {
      await expect(node.getByText(n.label, { exact: true })).toHaveCount(1);
    }
    await expect(node.locator('svg line')).toHaveCount(K.computeGraph.edges.length);
  });
});

test.describe('local layout kinds', () => {
  test('flex row sets data-direction and renders children', async ({ page }) => {
    const node = await openSpec(page, K.flexRow);
    await expect(node).toHaveAttribute('data-direction', 'row');
    await expect(node.locator('[data-kind="text"]')).toHaveCount(2);
  });

  test('grid uses the requested column count', async ({ page }) => {
    const node = await openSpec(page, K.grid);
    await expect(node).toHaveCSS('grid-template-columns', /^(\S+\s+){2}\S+$/);
    await expect(node.locator('[data-kind="text"]')).toHaveCount(3);
  });

  test('card renders header and body', async ({ page }) => {
    const node = await openSpec(page, K.card);
    await expect(node).toContainText('Card header fixture');
    await expect(node.locator('[data-kind="text"]')).toContainText('inside the card');
  });

  test('text renders markdown with its variant', async ({ page }) => {
    const node = await openSpec(page, K.text);
    await expect(node).toHaveAttribute('data-variant', 'muted');
    await expect(node.locator('strong')).toHaveText('text');
  });

  test('stat renders every label and value', async ({ page }) => {
    const node = await openSpec(page, K.stat);
    await expect(node).toContainText('Determinant');
    await expect(node).toContainText('42');
    await expect(node).toContainText('Rank');
  });

  test('answerbox renders a labelled input and a disabled Submit', async ({ page }) => {
    const node = await openSpec(page, K.answerbox);
    await expect(node).toContainText('What is the slope?');
    const input = node.getByTestId('answerbox-input');
    await expect(input).toHaveAttribute('placeholder', 'e.g. 2');
    const submit = page.getByTestId('answerbox-submit');
    await expect(submit).toBeDisabled();
    await input.fill('2');
    await expect(submit).toBeEnabled();
  });

  test('Submit stays disabled until every answerbox is filled', async ({ page }) => {
    await seedSpec(page, K.twoAnswerboxes);
    await page.goto('/');
    const inputs = page.getByTestId('answerbox-input');
    await expect(inputs).toHaveCount(2);
    const submit = page.getByTestId('answerbox-submit');
    await inputs.nth(0).fill('2');
    await expect(submit).toBeDisabled();
    await inputs.nth(1).fill('1');
    await expect(submit).toBeEnabled();
  });
});

test.describe('fallback and recovery', () => {
  test('unknown kinds fall through to retrofit-ui SpecRenderer', async ({ page }) => {
    await seedSpec(page, K.fallbackTimeline);
    await page.goto('/');
    const timeline = page.locator('ul.retrofit-timeline');
    await expect(timeline).toHaveCount(1);
    await expect(timeline.locator('li')).toHaveCount(2);
    await expect(timeline).toContainText('Fallback event one');
  });

  test('a truncated chalk-spec block renders a warning instead of crashing', async ({ page }) => {
    const conv = conversation('trunc', [
      userMessage('go'),
      assistantMessage('Here is a matrix:\n```chalk-spec\n{"kind":"chalk-matrix","values":[[1,2'),
    ]);
    await seedApp(page, { conversations: [conv], activeId: conv.id });
    await page.goto('/');
    await expect(page.getByText('Truncated')).toBeVisible();
    await expect(page.locator('[data-kind="chalk-matrix"]')).toHaveCount(0);
  });
});
