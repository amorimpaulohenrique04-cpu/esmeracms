import { expect, test as base, type Page } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  type BaselineFixtureMap,
  VISUAL_FIXED_TIME,
} from '../../src/visual-baseline/contract'

export const baselineAuthFile = path.join('artifacts', '.auth', 'baseline-admin.json')
const fixtureMapPath = path.join('artifacts', 'admin-baseline', 'fixture-map.json')

export const test = base.extend({
  page: async ({ page }, applyFixture) => {
    await page.clock.setFixedTime(new Date(VISUAL_FIXED_TIME))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await applyFixture(page)
  },
})

export async function readBaselineFixtures(): Promise<BaselineFixtureMap> {
  return JSON.parse(await fs.readFile(fixtureMapPath, 'utf8')) as BaselineFixtureMap
}

export async function settleVisualPage(page: Page) {
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready
  })
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
  await page.waitForTimeout(180)
}

export async function waitForInteractiveShell(page: Page) {
  const header = page.getByTestId('esmera-app-header')
  await expect(header).toBeVisible({ timeout: 15_000 })
  await expect(header).toHaveAttribute('data-shortcuts-ready', 'true', { timeout: 15_000 })
}

export { expect }
