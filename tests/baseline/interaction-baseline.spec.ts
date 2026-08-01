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

async function ensureAdmin(page: import('@playwright/test').Page) {
  const create = await page.request.post(`${baseURL}/api/users`, {
    data: { email, password, role: 'admin', name: 'Baseline Admin' },
  })
  if (!create.ok() && ![400, 401, 403, 409].includes(create.status())) {
    throw new Error(`Unable to bootstrap interaction baseline admin: HTTP ${create.status()} ${await create.text()}`)
  }

  const login = await page.request.post(`${baseURL}/api/users/login`, { data: { email, password } })
  expect(login.ok(), `Interaction baseline login failed: HTTP ${login.status()} ${await login.text()}`).toBeTruthy()
}

async function settle(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready
  })
  await page.waitForTimeout(180)
}

test('capture critical interactive visual states', async ({ page }) => {
  await ensureAdmin(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const outputDir = path.join('artifacts', 'admin-baseline', viewport.name)
    await fs.mkdir(outputDir, { recursive: true })

    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await settle(page)
    await page.locator('body').press('Tab')
    await page.screenshot({ path: path.join(outputDir, 'shell-keyboard-focus.png'), fullPage: true })

    await page.getByRole('button', { name: 'Buscar no CMS' }).click()
    await expect(page.getByTestId('esmera-command-palette')).toBeVisible()
    await settle(page)
    await page.screenshot({ path: path.join(outputDir, 'command-palette.png'), fullPage: true })
    await page.keyboard.press('Escape')

    if (viewport.width <= 768) {
      await page.getByRole('button', { name: 'Abrir navegação' }).click()
      await expect(page.getByTestId('esmera-mobile-nav')).toBeVisible()
      await settle(page)
      await page.screenshot({ path: path.join(outputDir, 'mobile-navigation-drawer.png'), fullPage: true })
      await page.keyboard.press('Escape')
    }
  }
})
