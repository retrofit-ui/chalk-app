import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  // The app talks to api.anthropic.com directly; every test either seeds
  // localStorage (no network) or intercepts /v1/messages via page.route().
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
});
