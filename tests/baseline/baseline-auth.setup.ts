import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test as setup } from '@playwright/test'

import { VISUAL_FIXED_TIME } from '../../src/visual-baseline/contract'
import { baselineAuthFile } from './fixtures'

const email = process.env.BASELINE_ADMIN_EMAIL || 'baseline.admin@esmera.local'
const password = process.env.BASELINE_ADMIN_PASSWORD || 'EsmeraBaseline-2026!'

setup('authenticate deterministic baseline administrator', async ({ page }) => {
  await page.clock.setFixedTime(new Date(VISUAL_FIXED_TIME))
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await page.fill('#field-email', email)
  await page.fill('#field-password', password)

  await Promise.all([
    page.waitForURL((url) => url.pathname === '/admin', { timeout: 20_000 }),
    page.click('button[type="submit"]'),
  ])

  await expect(page.getByTestId('esmera-nav')).toBeVisible({ timeout: 15_000 })

  const me = await page.request.get('/api/users/me')
  expect(me.ok(), `Baseline /api/users/me failed: HTTP ${me.status()} ${await me.text()}`).toBeTruthy()
  const body = await me.json() as { user?: { role?: string }; role?: string }
  expect(body.user?.role ?? body.role).toBe('admin')

  await fs.mkdir(path.dirname(baselineAuthFile), { recursive: true })
  await page.context().storageState({ path: baselineAuthFile })
})
