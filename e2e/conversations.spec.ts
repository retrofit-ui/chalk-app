import { test, expect } from '@playwright/test';
import { seedApp, conversation, userMessage, assistantMessage, CONV_STORAGE } from './helpers/seed';
import type { Conversation } from '../src/conversations';

const usage = {
  inputTokens: 1000,
  outputTokens: 500,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  costUsd: 1.23,
};

const costly = conversation('costly', [userMessage('hi'), assistantMessage('hello')], {
  title: 'Costly chat',
  usage,
});

async function storedConversations(page: import('@playwright/test').Page): Promise<Record<string, Conversation>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), CONV_STORAGE);
}

test.describe('switching conversations', () => {
  test('a new chat does not carry over the previous chat’s cost', async ({ page }) => {
    await seedApp(page, { conversations: [costly], activeId: 'costly' });
    await page.goto('/');
    await expect(page.locator('header').getByText('$1.23')).toBeVisible();

    await page.getByRole('button', { name: '+ New chat' }).click();

    await expect(page.locator('header').getByText('New conversation')).toBeVisible();
    await expect(page.locator('header').getByText('$1.23')).toHaveCount(0);
  });

  test('opening a chat with no usage does not show the previous chat’s cost', async ({ page }) => {
    const fresh = conversation('fresh', [userMessage('yo')], { title: 'Fresh chat' });
    await seedApp(page, { conversations: [costly, fresh], activeId: 'costly' });
    await page.goto('/');
    await expect(page.locator('header').getByText('$1.23')).toBeVisible();

    await page.getByRole('button', { name: 'Fresh chat', exact: true }).click();

    await expect(page.locator('header').getByText('Fresh chat')).toBeVisible();
    await expect(page.locator('header').getByText('$1.23')).toHaveCount(0);
  });

  test('a new chat started from a fork is not saved as a fork', async ({ page }) => {
    const fork = conversation('fork', [userMessage('hi')], {
      title: 'Forked chat',
      provenance: { parentId: 'costly', forkMessageIndex: 0 },
    });
    await seedApp(page, { conversations: [costly, fork], activeId: 'fork' });
    await page.goto('/');

    await page.getByRole('button', { name: '+ New chat' }).click();
    // Changing the model persists the active conversation.
    await page.getByTestId('model-select').selectOption({ index: 1 });

    const stored = Object.values(await storedConversations(page)).filter((c) => c.id !== 'costly' && c.id !== 'fork');
    expect(stored).toHaveLength(1);
    expect(stored[0].provenance).toBeUndefined();
    expect(stored[0].usage).toBeUndefined();
  });
});

test.describe('deleting conversations', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (d) => d.accept());
  });

  test('deletes a non-active chat and leaves the open one alone', async ({ page }) => {
    const other = conversation('other', [userMessage('bye')], { title: 'Other chat' });
    await seedApp(page, { conversations: [costly, other], activeId: 'costly' });
    await page.goto('/');

    await page.getByRole('button', { name: 'Delete “Other chat”' }).click();

    await expect(page.getByRole('button', { name: 'Other chat' })).toHaveCount(0);
    await expect(page.locator('header').getByText('Costly chat')).toBeVisible();
    expect(Object.keys(await storedConversations(page))).toEqual(['costly']);
  });

  test('deleting the open chat switches to a new one', async ({ page }) => {
    await seedApp(page, { conversations: [costly], activeId: 'costly' });
    await page.goto('/');

    await page.getByRole('button', { name: 'Delete “Costly chat”' }).click();

    await expect(page.locator('header').getByText('New conversation')).toBeVisible();
    await expect(page.locator('header').getByText('$1.23')).toHaveCount(0);
    await expect(page.getByText('hello')).toHaveCount(0);
    expect(await storedConversations(page)).toEqual({});
  });

  test('forks of a deleted chat move to the top level', async ({ page }) => {
    const fork = conversation('fork', [userMessage('hi')], {
      title: 'Forked chat',
      provenance: { parentId: 'costly', forkMessageIndex: 0 },
    });
    await seedApp(page, { conversations: [costly, fork], activeId: 'costly' });
    await page.goto('/');
    await expect(page.getByRole('button', { name: '⎇ Forked chat' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete “Costly chat”' }).click();

    await expect(page.getByRole('button', { name: 'Forked chat', exact: true })).toBeVisible();
    const stored = await storedConversations(page);
    expect(Object.keys(stored)).toEqual(['fork']);
    expect(stored.fork.provenance).toBeUndefined();
  });

  test('cancelling the confirm keeps the chat', async ({ page }) => {
    page.removeAllListeners('dialog');
    page.on('dialog', (d) => d.dismiss());
    await seedApp(page, { conversations: [costly], activeId: 'costly' });
    await page.goto('/');

    await page.getByRole('button', { name: 'Delete “Costly chat”' }).click();

    await expect(page.getByRole('button', { name: 'Costly chat', exact: true })).toBeVisible();
    expect(Object.keys(await storedConversations(page))).toEqual(['costly']);
  });
});
