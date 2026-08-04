import path from 'node:path'

import { defineConfig } from '@playwright/test'
import 'dotenv/config'

const baselineBaseURL = process.env.BASELINE_BASE_URL || 'http://localhost:3000'
const authFile = path.join('artifacts', '.auth', 'baseline-admin.json')

export default defineConfig({
  testDir: './tests/baseline',
  timeout: 480_000,
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: baselineBaseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'baseline-auth',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'baseline-chromium',
      testIgnore: /.*\.setup\.ts/,
      dependencies: ['baseline-auth'],
      use: { storageState: authFile },
    },
  ],
  webServer: {
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: `${baselineBaseURL}/admin`,
  },
})
