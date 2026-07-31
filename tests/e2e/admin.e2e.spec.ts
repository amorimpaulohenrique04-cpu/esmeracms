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

  test('uses a compact navigation rail at the 1024px boundary', async () => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('http://localhost:3000/admin')
    await expect(page.getByTestId('esmera-nav')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir navegação' })).toBeHidden()
    const navWidth = await page.getByTestId('esmera-nav').evaluate((element) => Math.round(element.getBoundingClientRect().width))
    expect(navWidth).toBeLessThanOrEqual(72)
    await page.setViewportSize({ width: 1440, height: 900 })
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

  test('lets operational workspaces use available width and respond to their own container', async () => {
    await page.setViewportSize({ width: 1920, height: 1000 })
    await page.goto('http://localhost:3000/admin')

    const desktopWorkspace = await page.locator('.esmera-view').evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        width: element.getBoundingClientRect().width,
        maxWidth: style.maxWidth,
        containerType: style.containerType,
      }
    })

    expect(desktopWorkspace.width).toBeGreaterThan(1500)
    expect(desktopWorkspace.maxWidth).toBe('none')
    expect(desktopWorkspace.containerType).toBe('inline-size')

    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('http://localhost:3000/admin')
    const tabletColumns = await page.locator('.esmera-metric-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length)
    expect(tabletColumns).toBe(2)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/admin')
    const mobileColumns = await page.locator('.esmera-metric-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(mobileColumns).toBe(1)
    expect(overflow).toBeLessThanOrEqual(1)

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
