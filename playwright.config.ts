import { defineConfig } from '@playwright/test';

export const baseURL = process.env.FREEAPI_BASE_URL ?? 'https://api.freeapi.app';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  reporter: [
    ['list'],
    ['allure-playwright', { resultsDir: 'allure-results' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
});
