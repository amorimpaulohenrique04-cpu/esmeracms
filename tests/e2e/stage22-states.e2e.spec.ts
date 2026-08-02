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
    await expect(contract.locator('[data-state="empty"]')).toBeVisible()
    await expect(contract.locator('[data-state="integration-unconfigured"]')).toBeVisible()
    await expect(contract.locator('[data-state="error"]')).toHaveAttribute('data-error-code', 'unknown')
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

    await page.getByRole('combobox', { name: 'Origem' }).selectOption('site')
    await page.getByRole('button', { name: 'Aplicar filtros' }).click()
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
    await palette.getByPlaceholder('Produto, cliente, venda ou ação…').fill('produto')
    await expect(palette.getByRole('alert')).toHaveText('Busca temporariamente indisponível.')
    await expect(palette.getByRole('option')).toHaveCount(0)
    await page.unroute('**/api/admin-search**')
  })
})
