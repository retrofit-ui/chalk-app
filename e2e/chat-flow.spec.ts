import { test, expect } from '@playwright/test';
import { seedApp, seedSpec, conversation, userMessage, assistantMessage, specFence, KEY_STORAGE } from './helpers/seed';
import { routeAnthropic, sseResponse, messageText } from './helpers/anthropicSse';
import * as K from './fixtures/kinds';

// Layer 2: real chat.ts + real @anthropic-ai/sdk streaming, with only the
// network boundary (POST /v1/messages) replaced by canned SSE bodies.

test.describe('sending a message', () => {
  test('streams the reply and renders an embedded chalk-spec block', async ({ page }) => {
    await seedApp(page);
    const api = await routeAnthropic(page, [
      sseResponse([{ type: 'text', text: 'Here is a 2×3 matrix:\n' + specFence(K.matrix) + '\nNice, right?' }]),
    ]);
    await page.goto('/');

    await page.getByTestId('composer-input').fill('show me a matrix');
    await page.getByTestId('composer-send').click();

    await expect(page.getByText('Here is a 2×3 matrix:')).toBeVisible();
    await expect(page.locator('[data-kind="chalk-matrix"] .font-mono')).toHaveCount(6);
    await expect(page.getByText('Nice, right?')).toBeVisible();

    expect(api.requests).toHaveLength(1);
    const [req] = api.requests;
    expect(req.stream).toBe(true);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe('user');
    expect(messageText(req.messages[0])).toBe('show me a matrix');
    // The user turn is derived into the conversation title and persisted.
    await expect(page.locator('header').getByText('show me a matrix')).toBeVisible();
  });

  test('a tool_use round-trip sends the tool_result back and saves the lesson plan', async ({ page }) => {
    await seedApp(page);
    const api = await routeAnthropic(page, [
      sseResponse(
        [{ type: 'tool_use', id: 'toolu_1', name: 'set_lesson_plan', input: { plan: '# Plan\n- derivatives' } }],
        'tool_use',
      ),
      sseResponse([{ type: 'text', text: 'Plan set. Let us begin.' }]),
    ]);
    await page.goto('/');

    await page.getByTestId('composer-input').fill('teach me calculus');
    await page.getByTestId('composer-send').click();

    await expect(page.getByText('Plan set. Let us begin.')).toBeVisible();
    await api.waitForRequests(2);
    expect(api.requests).toHaveLength(2);

    const second = api.requests[1].messages;
    const last = second[second.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toEqual([
      expect.objectContaining({ type: 'tool_result', tool_use_id: 'toolu_1', content: 'Plan saved.' }),
    ]);
    const assistantTurn = second[second.length - 2];
    expect(assistantTurn.role).toBe('assistant');
    expect(assistantTurn.content).toEqual([
      expect.objectContaining({ type: 'tool_use', id: 'toolu_1', name: 'set_lesson_plan' }),
    ]);

    await page.getByTitle('View lesson plan').click();
    await expect(page.getByText('derivatives')).toBeVisible();
  });
});

test.describe('interactive spec events become user turns', () => {
  test('answerbox Submit sends the collected answers', async ({ page }) => {
    await seedSpec(page, K.twoAnswerboxes);
    const api = await routeAnthropic(page, [sseResponse([{ type: 'text', text: 'Correct!' }])]);
    await page.goto('/');

    const inputs = page.getByTestId('answerbox-input');
    await inputs.nth(0).fill('2');
    await inputs.nth(1).fill('-1');
    await page.getByTestId('answerbox-submit').click();

    await expect(page.getByText('Correct!')).toBeVisible();
    expect(api.requests).toHaveLength(1);
    const msgs = api.requests[0].messages;
    const submitted = msgs[msgs.length - 1];
    expect(submitted.role).toBe('user');
    expect(messageText(submitted)).toBe("I've filled in my answers:\n- slope: 2\n- intercept: -1");
    // The event is also rendered in the transcript.
    await expect(page.getByText('User answered:')).toBeVisible();
  });

  test('clicking an interactive graph sends the marked coordinates', async ({ page }) => {
    await seedSpec(page, K.interactiveGraph);
    const api = await routeAnthropic(page, [sseResponse([{ type: 'text', text: 'Good point.' }])]);
    await page.goto('/');

    const plot = page.locator('[data-kind="chalk-graph"] .chalk-plot svg');
    await expect(plot).toBeVisible();
    await plot.click({ position: { x: 150, y: 120 } });
    await expect(page.getByText('1 point marked')).toBeVisible();
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText('Good point.')).toBeVisible();
    expect(api.requests).toHaveLength(1);
    const msgs = api.requests[0].messages;
    const sent = messageText(msgs[msgs.length - 1]);
    const match = sent.match(/^I clicked the point \((-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\) on the graph\.$/);
    expect(match, `unexpected graph-click message: ${sent}`).not.toBeNull();
    // The rendered event shows the same coordinates the model received.
    await expect(page.getByText(`clicked (${match![1]}, ${match![2]})`)).toBeVisible();
  });
});

test.describe('conversation management', () => {
  const seeded = () =>
    conversation('base', [
      userMessage('first question'),
      assistantMessage('first answer'),
      userMessage('second question'),
      assistantMessage('second answer'),
    ], { title: 'Base conversation' });

  test('fork creates a child conversation truncated at that message', async ({ page }) => {
    const conv = seeded();
    await seedApp(page, { conversations: [conv], activeId: conv.id });
    await page.goto('/');

    const rows = page.getByTestId('message');
    await expect(rows).toHaveCount(4);
    await rows.nth(1).hover();
    await rows.nth(1).getByTitle('Fork conversation from this message').click();

    await expect(page.locator('header').getByText('Base conversation (fork)')).toBeVisible();
    await expect(rows).toHaveCount(2);
    await expect(page.locator('nav').getByRole('button', { name: '⎇ Base conversation (fork)' })).toBeVisible();

    // Both conversations are persisted; the original is intact.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('chalk.conversations') ?? '{}'));
    const all = Object.values(stored) as Array<{ title: string; messages: unknown[]; provenance?: { parentId: string } }>;
    expect(all).toHaveLength(2);
    expect(all.find((c) => c.title === 'Base conversation')?.messages).toHaveLength(4);
    expect(all.find((c) => c.title === 'Base conversation (fork)')?.provenance?.parentId).toBe('base');
  });

  test('revert on a user message drops it and restores its text to the composer', async ({ page }) => {
    const conv = seeded();
    await seedApp(page, { conversations: [conv], activeId: conv.id });
    await page.goto('/');

    const rows = page.getByTestId('message');
    await rows.nth(2).hover();
    await rows.nth(2).getByTitle('Revert conversation to this message').click();

    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId('composer-input')).toHaveValue('second question');
  });
});

test.describe('API key gate', () => {
  test('without a key the gate is shown and saving one persists it', async ({ page }) => {
    await seedApp(page, { apiKey: null });
    await page.goto('/');

    await expect(page.getByTestId('keygate-input')).toBeVisible();
    await expect(page.getByTestId('composer-input')).toHaveCount(0);
    await expect(page.getByTestId('keygate-submit')).toBeDisabled();

    await page.getByTestId('keygate-input').fill('sk-ant-typed-in-test');
    await page.getByTestId('keygate-submit').click();

    await expect(page.getByTestId('composer-input')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY_STORAGE)).toBe('sk-ant-typed-in-test');
  });
});
