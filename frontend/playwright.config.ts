import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // For e2e tests, we need to run in production mode because:
  // 1. next-pwa's config disables service worker generation in development (`disable: process.env.NODE_ENV === "development"`)
  // 2. registerServiceWorker() only registers when `process.env.NODE_ENV === 'production'`
  // Running in dev mode means no service worker is ever registered, making PWA tests fail.
  // Production mode enables SW registration, allowing offline and caching tests to work properly.
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
