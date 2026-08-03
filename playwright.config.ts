import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180_000,
  globalTimeout: process.env.CI ? 30 * 60_000 : undefined,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Stop at the first real CI failure so diagnostics are available promptly. */
  maxFailures: process.env.CI ? 1 : 0,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Keep machine-readable progress plus the complete browser report. */
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }]],
  outputDir: 'test-results',
  /* Shared settings for all the projects below. */
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: true,
    url: 'http://localhost:3000',
    timeout: 180_000,
  },
})
