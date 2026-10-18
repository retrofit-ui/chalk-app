import { test, expect, type Page } from '@playwright/test';
import { seedApp } from './helpers/seed';
import { holdAnthropicStream } from './helpers/anthropicSse';

// While a reply streams, the message list follows it down, until the reader
// scrolls up. Then their view stays put while content grows below it, and
// following resumes once they scroll back to the bottom.

const lines = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => `Line ${from + i} of a long streaming reply.\n\n`).join('');

const metrics = (page: Page) =>
  page.getByTestId('messages').evaluate((el) => ({
    top: el.scrollTop,
    height: el.scrollHeight,
    fromBottom: el.scrollHeight - el.scrollTop - el.clientHeight,
  }));

test('scrolling up mid-stream unlocks the view; scrolling to the bottom locks it again', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await seedApp(page);
  const stream = await holdAnthropicStream(page);
  await page.goto('/');
  await page.getByTestId('composer-input').fill('go long');
  await page.getByTestId('composer-send').click();
  await stream.opened();

  // Locked: follows the stream down.
  await stream.sendText(lines(1, 40), 40);
  await expect(page.getByText('Line 40 of')).toBeAttached();
  await expect.poll(async () => (await metrics(page)).fromBottom).toBeLessThanOrEqual(2);

  // The reader scrolls up: the view must stay where they left it.
  await page.getByTestId('messages').hover();
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => (await metrics(page)).fromBottom).toBeGreaterThan(300);
  const parked = await metrics(page);

  await stream.sendText(lines(41, 40), 40);
  await expect(page.getByText('Line 80 of')).toBeAttached();
  const after = await metrics(page);
  expect(after.height).toBeGreaterThan(parked.height + 500);
  expect(after.top).toBe(parked.top);

  // Back to the bottom: following resumes.
  await page.mouse.wheel(0, 100_000);
  await expect.poll(async () => (await metrics(page)).fromBottom).toBeLessThanOrEqual(2);
  await stream.sendText(lines(81, 40), 40);
  await expect(page.getByText('Line 120 of')).toBeAttached();
  await expect.poll(async () => (await metrics(page)).fromBottom).toBeLessThanOrEqual(2);

  await stream.finish();
});

test('sending a new message re-locks to the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await seedApp(page);
  const stream = await holdAnthropicStream(page);
  await page.goto('/');
  await page.getByTestId('composer-input').fill('go long');
  await page.getByTestId('composer-send').click();
  await stream.opened();
  await stream.sendText(lines(1, 40), 40);
  await page.getByTestId('messages').hover();
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => (await metrics(page)).fromBottom).toBeGreaterThan(300);
  await stream.finish();

  // The next request isn't held; any reply will do; the point is the pin on send.
  await page.route('**/v1/messages', (r) => r.abort());
  await page.getByTestId('composer-input').fill('again');
  await page.getByTestId('composer-send').click();
  await expect.poll(async () => (await metrics(page)).fromBottom).toBeLessThanOrEqual(2);
});
