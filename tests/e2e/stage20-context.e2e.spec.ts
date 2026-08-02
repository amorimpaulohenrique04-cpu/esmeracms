import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test.describe('Stage 20 operational context', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('enters technical admin and returns without losing filters or view mode', async ({ page }) => {
    await login({ page, user: testUser })
    const operationalURL = 'http://localhost:3000/admin/products?view=grid&q=contexto-stage20'

    await page.goto(operationalURL)
    await expect(page).toHaveURL(operationalURL)
    await expect(page.getByRole('link', { name: 'Grid', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('input[name="q"]').first()).toHaveValue('contexto-stage20')

    await page.getByRole('link', { name: 'Admin técnico', exact: true }).click()
    await expect(page).toHaveURL('http://localhost:3000/admin/technical')
    await expect(page.getByRole('heading', { name: 'Admin técnico' })).toBeVisible()

    await page.goBack({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(operationalURL)
    await expect(page.getByRole('link', { name: 'Grid', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('input[name="q"]').first()).toHaveValue('contexto-stage20')
  })
})
