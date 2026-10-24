import { test, expect } from '@playwright/test';
import { seedApp, conversation, userMessage, assistantMessage } from './helpers/seed';
import { routeAnthropic, sseResponse } from './helpers/anthropicSse';

// Thinking on the 5.5 models: the effort picker, the request fields it drives,
// progress notes rendered as text, and thinking blocks replayed unchanged.

test('a new conversation runs Sonnet 5.5 at the chosen thinking level', async ({ page }) => {
  await seedApp(page);
  const api = await routeAnthropic(page, [sseResponse([{ type: 'text', text: 'Hi there.' }])]);
  await page.goto('/');

  await expect(page.getByTestId('model-select')).toHaveValue('claude-sonnet-5-5');
  await expect(page.getByTestId('effort-select')).toHaveValue('low');
  await page.getByTestId('effort-select').selectOption('medium');

  await page.getByTestId('composer-input').fill('hello');
  await page.getByTestId('composer-send').click();
  await expect(page.getByText('Hi there.')).toBeVisible();

  const [req] = api.requests;
  expect(req.model).toBe('claude-sonnet-5-5');
  expect(req.thinking).toEqual({ type: 'adaptive', display: 'updates' });
  expect(req.output_config).toEqual({ effort: 'medium' });
  expect(api.headers[0]['anthropic-beta']).toContain('thinking-display-updates-2026-08-18');
});

test('progress notes show beside the tool chip and thinking blocks go back unchanged', async ({ page }) => {
  await seedApp(page);
  const api = await routeAnthropic(page, [
    sseResponse(
      [
        { type: 'thinking', thinking: 'Let me pull up the graph docs.', signature: 'sig_1' },
        { type: 'tool_use', id: 'toolu_1', name: 'get_spec_docs', input: { kinds: ['chalk-graph'] } },
      ],
      'tool_use',
    ),
    sseResponse([
      { type: 'thinking', thinking: '', signature: 'sig_2' },
      { type: 'text', text: 'Here is the graph.' },
    ]),
  ]);
  await page.goto('/');

  await page.getByTestId('composer-input').fill('graph y = 2x');
  await page.getByTestId('composer-send').click();

  await expect(page.getByText('Here is the graph.')).toBeVisible();
  await expect(page.getByText('Let me pull up the graph docs.')).toBeVisible();
  await expect(page.getByText('looked up: chalk-graph')).toBeVisible();

  await api.waitForRequests(2);
  const assistantTurn = api.requests[1].messages[1];
  expect(assistantTurn.role).toBe('assistant');
  expect(assistantTurn.content).toEqual([
    { type: 'thinking', thinking: 'Let me pull up the graph docs.', signature: 'sig_1' },
    { type: 'tool_use', id: 'toolu_1', name: 'get_spec_docs', input: { kinds: ['chalk-graph'] } },
  ]);
});

test('a conversation saved on an older model keeps it and sends no thinking fields', async ({ page }) => {
  const conv = conversation('legacy', [userMessage('hi'), assistantMessage('hello')]);
  await seedApp(page, { conversations: [conv], activeId: conv.id });
  const api = await routeAnthropic(page, [sseResponse([{ type: 'text', text: 'Still here.' }])]);
  await page.goto('/');

  await expect(page.getByTestId('model-select')).toHaveValue('claude-sonnet-4-6');
  await expect(page.getByTestId('effort-select')).toHaveCount(0);

  await page.getByTestId('composer-input').fill('again');
  await page.getByTestId('composer-send').click();
  await expect(page.getByText('Still here.')).toBeVisible();

  const [req] = api.requests;
  expect(req.model).toBe('claude-sonnet-4-6');
  expect(req).not.toHaveProperty('thinking');
  expect(req).not.toHaveProperty('output_config');
  expect(api.headers[0]['anthropic-beta'] ?? '').not.toContain('thinking');
});

test('an old chat with a tool-use turn renders and continues after switching to Sonnet 5.5', async ({ page }) => {
  // The shapes chats were saved in before thinking: string replies, and tool-use turns
  // as [text, tool_use] arrays followed by a tool-result user turn. No effort field.
  const toolUse = { type: 'tool_use' as const, id: 'toolu_old', name: 'get_spec_docs', input: { kinds: ['chalk-graph'] } };
  const conv = conversation('old', [
    userMessage('is proportional linear?'),
    {
      id: 'a-old-tool', role: 'assistant', kind: 'tool-use',
      content: [{ type: 'text', text: 'Yes, by definition.' }, toolUse],
      toolUseData: { calls: [toolUse] },
    },
    { id: 'u-old-result', role: 'user', kind: 'tool-result', content: [{ type: 'tool_result', tool_use_id: 'toolu_old', content: 'docs' }] },
    assistantMessage('That is the whole story.'),
  ]);
  await seedApp(page, { conversations: [conv], activeId: conv.id });
  const api = await routeAnthropic(page, [sseResponse([{ type: 'text', text: 'Carrying on.' }])]);
  await page.goto('/');

  await expect(page.getByText('Yes, by definition.')).toBeVisible();
  await expect(page.getByText('looked up: chalk-graph')).toBeVisible();
  await expect(page.getByText('That is the whole story.')).toBeVisible();

  await page.getByTestId('model-select').selectOption('claude-sonnet-5-5');
  await expect(page.getByTestId('effort-select')).toHaveValue('low');
  await page.getByTestId('composer-input').fill('and nonlinear?');
  await page.getByTestId('composer-send').click();
  await expect(page.getByText('Carrying on.')).toBeVisible();

  const [req] = api.requests;
  expect(req.model).toBe('claude-sonnet-5-5');
  expect(req.output_config).toEqual({ effort: 'low' });
  expect(req.messages[1].content).toEqual([{ type: 'text', text: 'Yes, by definition.' }, toolUse]);
  expect(req.messages[3]).toEqual({ role: 'assistant', content: 'That is the whole story.' });
});
