import fs from 'node:fs/promises'
import path from 'node:path'

import { baselineViewports } from '../../src/visual-baseline/contract'
import { expect, settleVisualPage, test } from './fixtures'

test('capture privacy workspace visual baseline', async ({ page }) => {
  for (const viewport of baselineViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const response = await page.goto('/admin/privacy?q=Cliente+Privacidade+Baseline', { waitUntil: 'domcontentloaded' })
    expect(response?.status(), '/admin/privacy should render successfully').toBeLessThan(400)
    await expect(page.getByRole('heading', { name: 'Privacidade' }).first()).toBeVisible()
    await settleVisualPage(page)

    const outputDir = path.join('artifacts', 'admin-baseline', viewport.name)
    await fs.mkdir(outputDir, { recursive: true })
    await page.screenshot({ path: path.join(outputDir, 'privacy.png'), fullPage: true })
  }
})
