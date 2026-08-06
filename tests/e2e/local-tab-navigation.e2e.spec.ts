import { expect, Page, test } from '@playwright/test'

import { createDraftCategory } from '../helpers/createDraftEntities'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

async function delayRoute(page: Page, pathnameFragment: string, ms: number) {
  await page.route(`**${pathnameFragment}**`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
    await route.continue()
  })
}

async function assertShellStatic(page: Page) {
  for (const selector of ['[data-testid="esmera-app-header"]', '[data-testid="esmera-nav"]']) {
    await expect(page.locator(selector)).toBeVisible()
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

async function createCustomer(page: Page, stamp: number) {
  const response = await page.request.post('http://localhost:3000/api/customers', {
    data: {
      name: `Cliente Loading Local ${stamp}`,
      email: `loading-local-${stamp}@esmera.test`,
      status: 'active',
      origin: 'site',
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const body = await response.json() as { id?: string | number; doc?: { id?: string | number } }
  const id = body.id ?? body.doc?.id
  expect(id).toBeTruthy()
  return { id: id as string | number, name: `Cliente Loading Local ${stamp}` }
}

async function removeDocument(page: Page, collection: string, id: string | number) {
  await page.request.delete(`http://localhost:3000/api/${collection}/${id}?draft=true`).catch(() => undefined)
}

test.describe('Loading local em abas internas', () => {
  let page: Page
  let categoryId: string | number
  let customerId: string | number
  let customerName: string

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })

    const stamp = Date.now()
    categoryId = await createDraftCategory(page, `loading-local-${stamp}`)
    const customer = await createCustomer(page, stamp)
    customerId = customer.id
    customerName = customer.name
  })

  test.afterAll(async () => {
    if (page) {
      await removeDocument(page, 'customers', customerId)
      await removeDocument(page, 'categories', categoryId)
      await page.context().close()
    }
    await cleanupTestUser()
  })

  test.afterEach(async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  })

  test('FormShell mantém o shell e mostra feedback local em Categorias', async () => {
    await page.goto(`http://localhost:3000/admin/categories?category=${categoryId}&tab=general`)
    const detail = page.locator('.esmera-category-detail')
    await expect(detail.getByRole('heading', { name: /Categoria Concorrência loading-local-/ })).toBeVisible()
    await delayRoute(page, '/admin/categories', 650)

    await detail.getByRole('link', { name: 'Produtos relacionados', exact: true }).click()

    await expect(page.getByTestId('esmera-route-skeleton')).toHaveCount(0)
    await expect(detail.locator('[data-state="loading"]')).toBeVisible()
    await expect(detail.locator('.esmera-category-detail__header')).toBeVisible()
    await assertShellStatic(page)
    await assertNoOverflow(page)

    await expect(page).toHaveURL(new RegExp(`/admin/categories\\?.*category=${categoryId}.*tab=products`))
    await expect(detail.locator('[data-state="loading"]')).toHaveCount(0)
    await expect(detail.getByRole('heading', { name: 'Produtos relacionados', exact: true })).toBeVisible()
    await expect(page.getByTestId('esmera-route-skeleton')).toHaveCount(0)
  })

  test('SectionNavLink mantém o shell e mostra feedback local em Clientes', async () => {
    await page.goto(`http://localhost:3000/admin/customers?customer=${customerId}&tab=overview`)
    const detail = page.locator('.esmera-customer-detail')
    await expect(detail.getByRole('heading', { name: customerName, exact: true })).toBeVisible()
    await delayRoute(page, '/admin/customers', 650)

    await detail.getByRole('link', { name: 'Histórico', exact: true }).click()

    await expect(page.getByTestId('esmera-route-skeleton')).toHaveCount(0)
    await expect(detail.locator('[data-state="loading"]')).toBeVisible()
    await expect(detail.locator('.esmera-customer-detail__header')).toBeVisible()
    await assertShellStatic(page)
    await assertNoOverflow(page)

    await expect(page).toHaveURL(new RegExp(`/admin/customers\\?.*customer=${customerId}.*tab=history`))
    await expect(detail.locator('[data-state="loading"]')).toHaveCount(0)
    await expect(detail.getByRole('heading', { name: 'Histórico relacional', exact: true })).toBeVisible()
    await expect(page.getByTestId('esmera-route-skeleton')).toHaveCount(0)
  })
})
