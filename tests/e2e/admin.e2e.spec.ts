import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('loads the Esmera operational dashboard', async () => {
    await page.goto('http://localhost:3000/admin')
    await expect(page).toHaveURL('http://localhost:3000/admin')
    await expect(page.getByTestId('esmera-nav')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Olá, Esméra/i })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', /^pt/)
  })

  test('can navigate to the technical users list', async () => {
    await page.goto('http://localhost:3000/admin/collections/users')
    await expect(page).toHaveURL('http://localhost:3000/admin/collections/users')
    await expect(page.getByRole('heading', { name: /Usuários/i }).first()).toBeVisible()
  })

  test('can navigate to a user edit view', async () => {
    await page.goto('http://localhost:3000/admin/collections/users/create')
    await expect(page).toHaveURL(/\/admin\/collections\/users\/[a-zA-Z0-9-_]+/)
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })

  test('operational reports never render placeholder traffic metrics', async () => {
    await page.goto('http://localhost:3000/admin/reports')
    await expect(page.getByText('Nenhum percentual é fixo.')).toBeVisible()
    await expect(page.getByText('15%')).toHaveCount(0)
  })
})
