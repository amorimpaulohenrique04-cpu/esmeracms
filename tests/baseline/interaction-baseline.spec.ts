import fs from 'node:fs/promises'
import path from 'node:path'

import { baselineViewports } from '../../src/visual-baseline/contract'
import { expect, settleVisualPage, test, waitForInteractiveShell } from './fixtures'

test('capture critical interactive visual states', async ({ page }) => {
  for (const viewport of baselineViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const outputDir = path.join('artifacts', 'admin-baseline', viewport.name)
    await fs.mkdir(outputDir, { recursive: true })

    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await waitForInteractiveShell(page)
    await settleVisualPage(page)

    await page.keyboard.press('Tab')
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true)
    await page.screenshot({ path: path.join(outputDir, 'shell-keyboard-focus.png'), fullPage: true })

    await page.keyboard.press('Control+k')
    const palette = page.getByTestId('esmera-command-palette')
    await expect(palette).toBeVisible({ timeout: 15_000 })
    await settleVisualPage(page)
    await page.screenshot({ path: path.join(outputDir, 'command-palette.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()

    if (viewport.width <= 768) {
      await page.getByRole('button', { name: 'Abrir navegação' }).click()
      const mobileNav = page.getByTestId('esmera-mobile-nav')
      await expect(mobileNav).toBeVisible({ timeout: 15_000 })
      await settleVisualPage(page)
      await page.screenshot({ path: path.join(outputDir, 'mobile-navigation-drawer.png'), fullPage: true })
      await page.keyboard.press('Escape')
      await expect(mobileNav).toBeHidden()
    }
  }
})
