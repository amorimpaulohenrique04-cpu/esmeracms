import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test.describe('Stage 22 state contract', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('renders the shared loading, empty, integration and error states', async ({ page }) => {
    await login({ page, user: testUser })
    await page.goto('http://localhost:3000/admin/technical')

    const contract = page.getByTestId('state-contract')
    await expect(contract).toBeVisible()
    await expect(contract.locator('[data-state="empty-result"]')).toBeVisible()
    await expect(contract.locator('[data-state="integration-unconfigured"]')).toBeVisible()
    const recoverableError = page.locator('.esmera-technical-state-error [data-state="recoverable-error"]')
    await expect(recoverableError).toBeVisible()
    await expect(recoverableError).toContainText('Falha de consulta')
    await expect(recoverableError).toContainText('Os últimos dados válidos devem permanecer visíveis.')
    await expect(contract.locator('[aria-busy="true"]')).toBeVisible()
  })

  test('keeps the last valid report visible when the next query fails', async ({ page }) => {
    await login({ page, user: testUser })
    await page.goto('http://localhost:3000/admin/reports')
    const opportunityKpi = page.getByRole('button', { name: /Oportunidades/ }).first()
    await expect(opportunityKpi).toBeVisible()
    const previousText = await opportunityKpi.textContent()

    await page.route(/\/api\/admin-reports\?/, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'query_error', error: 'Falha controlada da consulta.' }),
      })
    })

    const dimensions = page.locator('details.esmera-report-filter-advanced')
    await dimensions.locator('summary').click()
    await expect(dimensions).toHaveAttribute('open', '')
    await page.getByRole('combobox', { name: 'Origem' }).selectOption('site')
    await page.getByRole('button', { name: 'Aplicar recorte' }).click()
    await expect(page.getByText('Falha controlada da consulta.')).toBeVisible({ timeout: 15_000 })
    await expect(opportunityKpi).toHaveText(previousText || '')
    await expect(page.locator('.esmera-view')).not.toContainText(/NaN|Infinity|undefined/)
    await page.unroute(/\/api\/admin-reports\?/)
  })

  test('shows a query failure in command search instead of fake results', async ({ page }) => {
    await login({ page, user: testUser })
    await page.route('**/api/admin-search**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'query_error', error: 'Busca temporariamente indisponível.' }),
      })
    })

    await page.goto('http://localhost:3000/admin')
    await page.getByRole('button', { name: 'Buscar no CMS' }).click()
    const palette = page.getByTestId('esmera-command-palette')
    await expect(palette).toBeVisible()
    await palette.getByRole('textbox', { name: 'Buscar no CMS' }).fill('produto')
    const searchError = palette.getByRole('alert')
    await expect(searchError).toContainText('Não foi possível pesquisar')
    await expect(searchError).toContainText('Busca temporariamente indisponível.')
    const localResults = palette.locator('[role="option"].is-local')
    await expect(palette.locator('[role="option"]:not(.is-local)')).toHaveCount(0)
    await expect(localResults).toHaveCount(1)
    await expect(localResults).toContainText('Performance do catálogo')
    await page.unroute('**/api/admin-search**')
  })
})
