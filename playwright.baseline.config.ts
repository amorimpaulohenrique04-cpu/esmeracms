import { defineConfig } from '@playwright/test'
import 'dotenv/config'

export default defineConfig({
  testDir: './tests/baseline',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: process.env.BASELINE_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: 'http://127.0.0.1:3000/admin',
  },
})
