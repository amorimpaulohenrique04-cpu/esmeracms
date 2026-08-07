import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

const SHELL_SELECTORS = ['[data-testid="esmera-app-header"]', '[data-testid="esmera-nav"]']

async function assertShellStatic(page: Page) {
  for (const selector of SHELL_SELECTORS) {
    const state = await page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element)
      return { opacity: style.opacity, transform: style.transform }
    })
    expect(state.opacity).toBe('1')
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(state.transform)
  }
}

async function assertNoViewTransitionAnimations(page: Page) {
  const activeViewTransitionAnimations = await page.evaluate(() =>
    document.getAnimations().filter((animation) => {
      const effect = animation.effect as KeyframeEffect | null
      return Boolean(effect?.pseudoElement?.startsWith('::view-transition'))
    }).length,
  )
  expect(activeViewTransitionAnimations).toBe(0)
}

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe('Admin motion — navegação de rota sem snapshot animado', () => {
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

  test('navega entre Dashboard, Produtos, Categorias, Clientes e Vendas sem misturar rotas', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/admin')
    await expect(page.getByRole('heading', { name: /Olá, Esméra/i })).toBeVisible()

    const steps: Array<{ href: string; url: RegExp; heading: string; staleHeading: string }> = [
      { href: '/admin/products', url: /\/admin\/products$/, heading: 'Produtos', staleHeading: 'Olá, Esméra' },
      { href: '/admin/categories', url: /\/admin\/categories$/, heading: 'Categorias', staleHeading: 'Produtos' },
      { href: '/admin/customers', url: /\/admin\/customers$/, heading: 'Clientes', staleHeading: 'Categorias' },
      { href: '/admin/sales', url: /\/admin\/sales$/, heading: 'Vendas', staleHeading: 'Clientes' },
      { href: '/admin', url: /\/admin\/?$/, heading: 'Olá, Esméra', staleHeading: 'Vendas' },
    ]

    for (const step of steps) {
      await page.getByTestId('esmera-nav').locator(`a[href="${step.href}"]`).click()
      await expect(page).toHaveURL(step.url)
      await expect(page.getByRole('heading', { name: new RegExp(step.heading, 'i') }).first()).toBeVisible()
      await expect(page.getByTestId('esmera-nav')).toBeVisible()
      await expect(page.getByTestId('esmera-app-header')).toBeVisible()
      await expect(page.getByRole('heading', { name: new RegExp(step.staleHeading, 'i') })).toHaveCount(0)
      await assertShellStatic(page)
      await assertNoViewTransitionAnimations(page)
      await assertNoOverflow(page)
    }
  })

  test('respeita prefers-reduced-motion: navegação continua instantânea e utilizável', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/admin')
    await expect(page.getByRole('heading', { name: /Olá, Esméra/i })).toBeVisible()

    await page.getByTestId('esmera-nav').locator('a[href="/admin/products"]').click()
    await expect(page).toHaveURL(/\/admin\/products$/)
    await expect(page.getByRole('heading', { name: 'Produtos' }).first()).toBeVisible()
    await assertShellStatic(page)
    await assertNoViewTransitionAnimations(page)

    const inspectorAnimationCount = await page.evaluate(() => document.getAnimations().length)
    expect(inspectorAnimationCount).toBeLessThanOrEqual(4)

    await page.getByTestId('esmera-nav').locator('a[href="/admin"]').first().click()
    await expect(page).toHaveURL(/\/admin\/?$/)
    await expect(page.getByRole('heading', { name: /Olá, Esméra/i })).toBeVisible()

    await page.emulateMedia({ reducedMotion: 'no-preference' })
  })
})
