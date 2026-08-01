import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.BASELINE_BASE_URL || 'http://127.0.0.1:3000'
const email = process.env.BASELINE_ADMIN_EMAIL || 'baseline.admin@esmera.local'
const password = process.env.BASELINE_ADMIN_PASSWORD || 'EsmeraBaseline-2026!'

const viewports = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'notebook-1280x800', width: 1280, height: 800 },
  { name: 'tablet-landscape-1024x768', width: 1024, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
] as const

test('capture privacy workspace visual baseline', async ({ page }) => {
  const createUser = await page.request.post(`${baseURL}/api/users`, {
    data: { email, password, role: 'admin', name: 'Baseline Admin' },
  })
  if (!createUser.ok() && ![400, 401, 403, 409].includes(createUser.status())) {
    throw new Error(`Unable to bootstrap baseline admin: HTTP ${createUser.status()} ${await createUser.text()}`)
  }

  const login = await page.request.post(`${baseURL}/api/users/login`, { data: { email, password } })
  expect(login.ok(), `Baseline admin login failed: HTTP ${login.status()} ${await login.text()}`).toBeTruthy()

  const stamp = Date.now()
  const createCustomer = await page.request.post(`${baseURL}/api/admin-customers`, {
    data: {
      action: 'create',
      data: {
        name: 'Cliente Privacidade Baseline',
        email: `privacidade.baseline.${stamp}@example.com`,
        status: 'follow_up',
        origin: 'site',
        marketingConsent: true,
        tags: ['lgpd', 'baseline'],
      },
    },
  })
  expect(createCustomer.ok(), `Baseline privacy customer create failed: HTTP ${createCustomer.status()} ${await createCustomer.text()}`).toBeTruthy()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const response = await page.goto('/admin/privacy?q=Cliente+Privacidade+Baseline', { waitUntil: 'domcontentloaded' })
    expect(response?.status(), '/admin/privacy should render successfully').toBeLessThan(400)
    await expect(page.getByRole('heading', { name: 'Privacidade' }).first()).toBeVisible()
    await page.evaluate(async () => {
      if ('fonts' in document) await document.fonts.ready
    })
    await page.waitForTimeout(250)
    const outputDir = path.join('artifacts', 'admin-baseline', viewport.name)
    await fs.mkdir(outputDir, { recursive: true })
    await page.screenshot({ path: path.join(outputDir, 'privacy.png'), fullPage: true })
  }
})
