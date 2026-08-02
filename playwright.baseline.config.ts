import { defineConfig } from '@playwright/test'
import 'dotenv/config'

const baselineBaseURL = process.env.BASELINE_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/baseline',
  timeout: 480_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: baselineBaseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: `${baselineBaseURL}/admin`,
  },
})
