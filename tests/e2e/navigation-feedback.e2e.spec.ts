import { test, expect, Page } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

/**
 * Atraso determinístico injetado na resposta de navegação, para exercitar as
 * janelas de tempo do feedback (limiar do skeleton ~180ms, texto discreto
 * ~1.2s) sem depender da velocidade real do dev server. O atraso é a
 * condição deliberada sendo testada, não um sleep usado como sincronização.
 */
async function delayRoute(page: Page, pathnameFragment: string, ms: number) {
  await page.route(`**${pathnameFragment}**`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
    await route.continue()
  })
}

async function assertShellStatic(page: Page) {
  for (const selector of ['[data-testid="esmera-app-header"]', '[data-testid="esmera-nav"]']) {
    const state = await page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element)
      return { opacity: style.opacity, transform: style.transform }
    })
    expect(state.opacity).toBe('1')
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(state.transform)
  }
}

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe('Feedback de navegação do Admin (F12)', () => {
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

  test.afterEach(async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  })

  test('feedback visual aparece em até 100ms após o clique', async () => {
    await page.goto('http://localhost:3000/admin')
    await delayRoute(page, '/admin/categories', 700)

    const bar = page.locator('.esmera-route-progress')
    await expect(bar).toHaveAttribute('data-phase', 'idle')

    await page.getByTestId('esmera-nav').getByRole('link', { name: 'Categorias', exact: true }).click()
    await expect(bar).toHaveAttribute('data-phase', /intent|loading/, { timeout: 100 })

    await expect(page).toHaveURL(/\/admin\/categories$/)
  })

  test('skeleton não aparece em navegação rápida (abaixo do limiar de ~180ms)', async () => {
    await page.goto('http://localhost:3000/admin')
    await delayRoute(page, '/admin/customers', 60)

    await page.getByTestId('esmera-nav').getByRole('link', { name: 'Clientes', exact: true }).click()
    await page.waitForTimeout(120)
    await expect(page.getByTestId('esmera-route-skeleton')).toHaveCount(0)

    await expect(page).toHaveURL(/\/admin\/customers$/)
    await expect(page.getByTestId('esmera-route-skeleton')).toHaveCount(0)
  })

  test('skeleton aparece (variante form) quando a navegação demora e some ao concluir', async () => {
    await page.goto('http://localhost:3000/admin/products')
    await delayRoute(page, '/admin/collections/products/create', 900)

    await page.getByTestId('esmera-global-create').click()
    await page.getByRole('menuitem', { name: /Novo produto/i }).click()

    const skeleton = page.getByTestId('esmera-route-skeleton')
    await expect(skeleton).toBeVisible({ timeout: 700 })
    await expect(skeleton).toHaveAttribute('data-variant', 'form')
    await expect(skeleton).toHaveAttribute('aria-busy', 'true')

    await expect(page).toHaveURL(/\/admin\/collections\/products\/create$/, { timeout: 2000 })
    await expect(skeleton).toHaveCount(0)
  })

  test('texto discreto só aparece perto de 1,2s e nunca em navegação curta', async () => {
    await page.goto('http://localhost:3000/admin/products')
    await delayRoute(page, '/admin/collections/products/create', 1500)

    await page.getByTestId('esmera-global-create').click()
    await page.getByRole('menuitem', { name: /Novo produto/i }).click()

    const srText = page.getByTestId('esmera-route-skeleton').locator('.esmera-sr-only')
    await expect(srText).toHaveText('', { timeout: 300 })
    await expect(srText).toHaveText(/Preparando/, { timeout: 1500 })

    await expect(page).toHaveURL(/\/admin\/collections\/products\/create$/, { timeout: 2000 })
  })

  test('header e sidebar permanecem estáveis durante navegação lenta', async () => {
    await page.goto('http://localhost:3000/admin')
    await delayRoute(page, '/admin/sales', 600)

    await page.getByTestId('esmera-nav').getByRole('link', { name: 'Vendas', exact: true }).click()
    await page.waitForTimeout(250)
    await expect(page.getByTestId('esmera-route-skeleton')).toBeVisible()
    await assertShellStatic(page)
    await expect(page.getByTestId('esmera-nav')).toBeVisible()
    await expect(page.getByTestId('esmera-app-header')).toBeVisible()
    await assertNoOverflow(page)

    await expect(page).toHaveURL(/\/admin\/sales$/)
  })

  test('a barra completa ao concluir a rota e volta a idle', async () => {
    await page.goto('http://localhost:3000/admin')
    const bar = page.locator('.esmera-route-progress')

    await page.getByTestId('esmera-nav').getByRole('link', { name: 'Categorias', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/categories$/)
    await expect(bar).toHaveAttribute('data-phase', 'complete')
    await expect(bar).toHaveAttribute('data-phase', 'idle', { timeout: 2000 })
  })

  test('clicar no link da rota atual não inicia feedback', async () => {
    await page.goto('http://localhost:3000/admin')
    const bar = page.locator('.esmera-route-progress')

    await page.getByTestId('esmera-nav').getByRole('link', { name: 'Dashboard', exact: true }).click()
    await page.waitForTimeout(150)
    await expect(bar).toHaveAttribute('data-phase', 'idle')
  })

  test('Ctrl+clique (abre nova aba) não inicia feedback', async () => {
    await page.goto('http://localhost:3000/admin')
    const bar = page.locator('.esmera-route-progress')

    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByTestId('esmera-nav').getByRole('link', { name: 'Categorias', exact: true }).click({ modifiers: ['Control'] }),
    ])
    await popup.close()
    await expect(bar).toHaveAttribute('data-phase', 'idle')
    await expect(page).toHaveURL(/\/admin\/?$/)
  })

  test('link externo (target=_blank) não inicia feedback', async () => {
    await page.goto('http://localhost:3000/admin')
    await page.evaluate(() => {
      const anchor = document.createElement('a')
      anchor.href = 'https://example.com/'
      anchor.textContent = 'external-test-link'
      anchor.id = 'external-test-link'
      anchor.target = '_blank'
      document.body.appendChild(anchor)
    })

    const bar = page.locator('.esmera-route-progress')
    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      page.click('#external-test-link'),
    ])
    await popup.close()
    await expect(bar).toHaveAttribute('data-phase', 'idle')

    await page.evaluate(() => document.getElementById('external-test-link')?.remove())
  })

  test('cliques consecutivos não deixam skeleton/loader órfão', async () => {
    await page.goto('http://localhost:3000/admin')
    await delayRoute(page, '/admin/categories', 500)
    await delayRoute(page, '/admin/customers', 100)

    const nav = page.getByTestId('esmera-nav')
    await nav.getByRole('link', { name: 'Categorias', exact: true }).click()
    await page.waitForTimeout(50)
    await nav.getByRole('link', { name: 'Clientes', exact: true }).click()

    await expect(page).toHaveURL(/\/admin\/customers$/)
    await expect(page.getByTestId('esmera-route-skeleton')).toHaveCount(0)
    await expect(page.locator('.esmera-route-progress')).toHaveAttribute('data-phase', 'idle', { timeout: 2000 })
  })

  test('nenhuma View Transition global entra em jogo durante a navegação', async () => {
    await page.goto('http://localhost:3000/admin')
    await delayRoute(page, '/admin/categories', 500)

    await page.getByTestId('esmera-nav').getByRole('link', { name: 'Categorias', exact: true }).click()
    await page.waitForTimeout(250)
    const activeViewTransitions = await page.evaluate(() =>
      document.getAnimations().filter((animation) => {
        const effect = animation.effect as KeyframeEffect | null
        return Boolean(effect?.pseudoElement?.startsWith('::view-transition'))
      }).length,
    )
    expect(activeViewTransitions).toBe(0)
    await expect(page).toHaveURL(/\/admin\/categories$/)
  })

  test('navegação por teclado (Enter em link focado) aciona o mesmo feedback', async () => {
    await page.goto('http://localhost:3000/admin')
    await delayRoute(page, '/admin/categories', 400)

    const link = page.getByTestId('esmera-nav').getByRole('link', { name: 'Categorias', exact: true })
    await link.focus()
    const bar = page.locator('.esmera-route-progress')
    await page.keyboard.press('Enter')
    await expect(bar).toHaveAttribute('data-phase', /intent|loading/, { timeout: 200 })
    await expect(page).toHaveURL(/\/admin\/categories$/)
  })

  test('prefers-reduced-motion: feedback continua funcional sem deslocamento do shell', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('http://localhost:3000/admin')
    await delayRoute(page, '/admin/categories', 400)

    await page.getByTestId('esmera-nav').getByRole('link', { name: 'Categorias', exact: true }).click()
    await page.waitForTimeout(220)
    await expect(page.getByTestId('esmera-route-skeleton')).toBeVisible()
    await assertShellStatic(page)
    await expect(page).toHaveURL(/\/admin\/categories$/)

    await page.emulateMedia({ reducedMotion: 'no-preference' })
  })
})
