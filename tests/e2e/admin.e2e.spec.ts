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

  test('loads the Esmera operational dashboard and final shell', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/admin')
    await expect(page).toHaveURL('http://localhost:3000/admin')
    await expect(page.getByTestId('esmera-nav')).toBeVisible()
    await expect(page.getByTestId('esmera-app-header')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Olá, Esméra/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Conteúdo do site' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Pipeline', exact: true })).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('lang', /^pt/)
  })

  test('opens the authenticated command palette', async () => {
    await page.goto('http://localhost:3000/admin')
    await page.getByRole('button', { name: 'Buscar no CMS' }).click()
    await expect(page.getByTestId('esmera-command-palette')).toBeVisible()
    await expect(page.getByText('Abrir Dashboard', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('esmera-command-palette')).toBeHidden()
  })

  test('keeps pipeline as a view inside Sales and redirects the legacy route', async () => {
    await page.goto('http://localhost:3000/admin/pipeline')
    await expect(page).toHaveURL(/\/admin\/sales\?view=pipeline$/)
    await expect(page.getByRole('heading', { name: 'Vendas' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pipeline', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('uses the Esmera mobile drawer instead of leaving the sidebar behind content', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/admin')
    await expect(page.getByTestId('esmera-nav')).toBeHidden()
    await page.getByRole('button', { name: 'Abrir navegação' }).click()
    await expect(page.getByTestId('esmera-mobile-nav')).toBeVisible()
    await expect(page.getByTestId('esmera-mobile-nav').getByRole('link', { name: 'Dashboard' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('can navigate to the technical users list', async () => {
    await page.goto('http://localhost:3000/admin/collections/users')
    await expect(page).toHaveURL('http://localhost:3000/admin/collections/users')
    await expect(page.getByRole('heading', { name: /Usuários/i }).first()).toBeVisible()
    await expect(page.getByTestId('esmera-app-header')).toBeVisible()
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
