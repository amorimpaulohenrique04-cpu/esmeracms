import { expect, Page, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test.describe('Reports workspace', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('persists global filters in the URL and keeps previous data visible while refreshing', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/admin/reports')

    await expect(page.getByRole('heading', { name: 'Relatórios' }).first()).toBeVisible()
    await expect(page.getByTestId('reports-workspace')).toBeVisible()
    await expect(page.getByRole('button', { name: /Oportunidades/ }).first()).toBeVisible()
    await expect(page.getByRole('img', { name: /Evolução diária/ })).toBeVisible()

    let releaseRequest: () => void = () => {}
    let markRequestStarted: () => void = () => {}
    const requestGate = new Promise<void>((resolve) => { releaseRequest = resolve })
    const requestStarted = new Promise<void>((resolve) => { markRequestStarted = resolve })
    await page.route('**/api/admin-reports?*', async (route) => {
      markRequestStarted()
      await requestGate
      await route.continue()
    })

    await page.getByRole('combobox', { name: 'Comparar com' }).selectOption('previous_period')
    await page.getByRole('button', { name: 'Aplicar filtros' }).click()

    await requestStarted
    await expect(page).toHaveURL(/compareWith=previous_period/)
    await expect(page.getByTestId('reports-workspace')).toHaveClass(/is-refreshing/)
    await expect(page.getByRole('button', { name: /Oportunidades/ }).first()).toBeVisible()

    releaseRequest()
    await expect(page.getByTestId('reports-workspace')).not.toHaveClass(/is-refreshing/, { timeout: 15_000 })
    await page.unroute('**/api/admin-reports?*')
  })

  test('copies the exact filtered URL and drills down to real records', async () => {
    await page.goto('http://localhost:3000/admin/reports')
    await page.getByRole('combobox', { name: 'Origem' }).selectOption('site')
    await page.getByRole('button', { name: 'Aplicar filtros' }).click()
    await expect(page).toHaveURL(/source=site/)

    await page.getByRole('button', { name: 'Compartilhar' }).click()
    await expect(page.getByText('URL exata copiada.')).toBeVisible()
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain('/admin/reports?')
    expect(clipboard).toContain('source=site')
    expect(clipboard).toContain('from=')
    expect(clipboard).toContain('to=')

    await page.getByRole('button', { name: /Oportunidades/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Oportunidades criadas' })).toBeVisible()
    await expect(page.getByText(/Registros nativos criados/)).toBeVisible()
    await page.getByRole('button', { name: 'Fechar' }).click()
  })

  test('keeps reports responsive without document-level overflow', async () => {
    for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.goto('http://localhost:3000/admin/reports')
      await expect(page.getByTestId('reports-workspace')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    }
  })
})
