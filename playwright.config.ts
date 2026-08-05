import { defineConfig, devices } from '@playwright/test'

import 'dotenv/config'

const isCI = Boolean(process.env.CI)
const baseURL = 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: isCI ? 90_000 : 180_000,
  globalTimeout: isCI ? 15 * 60_000 : undefined,
  expect: {
    timeout: isCI ? 10_000 : 5_000,
  },
  forbidOnly: isCI,
  fullyParallel: false,
  maxFailures: 0,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
    actionTimeout: isCI ? 15_000 : 0,
    navigationTimeout: isCI ? 30_000 : 0,
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
    trace: isCI ? 'retain-on-failure' : 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: isCI ? 'pnpm start' : 'pnpm dev',
    reuseExistingServer: !isCI,
    url: baseURL,
    timeout: isCI ? 120_000 : 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
