import { expect, Page, test } from '@playwright/test'

import { createDraftProduct } from '../helpers/createDraftEntities'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test.describe('Popups de criação dos workspaces', () => {
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

  test('cria venda confirmada e categoria rascunho sem sair dos workspaces', async () => {
    test.setTimeout(120_000)
    const stamp = Date.now()
    const customerName = `Cliente Popup E2E ${stamp}`
    const productTitle = `Produto Popup E2E ${stamp}`
    const categoryTitle = `Categoria Popup E2E ${stamp}`

    const customerResponse = await page.request.post('http://localhost:3000/api/admin-customers', {
      data: {
        action: 'create',
        force: true,
        data: {
          name: customerName,
          phone: `819${String(stamp).slice(-8)}`,
          origin: 'whatsapp',
        },
      },
    })
    expect(customerResponse.ok(), `customer create failed: ${customerResponse.status()} ${await customerResponse.text()}`).toBeTruthy()
    const customer = await customerResponse.json() as { id?: string | number }
    expect(customer.id).toBeTruthy()

    const productID = await createDraftProduct(page, `popup-${stamp}`)
    const productResponse = await page.request.patch(`http://localhost:3000/api/products/${productID}?draft=true`, {
      data: {
        title: productTitle,
        slug: `produto-popup-e2e-${stamp}`,
        code: `POP-${stamp}`,
        availability: 'unique',
        basePriceCents: 12_345,
      },
    })
    expect(productResponse.ok(), `product update failed: ${productResponse.status()} ${await productResponse.text()}`).toBeTruthy()

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/admin/opportunities')
    await page.getByRole('button', { name: 'Nova venda' }).click()
    await expect(page.getByRole('heading', { name: 'Nova venda' })).toBeVisible()

    const customerInput = page.getByRole('combobox', { name: 'Buscar cliente' })
    await customerInput.fill(customerName)
    const customerOption = page.getByRole('option').filter({ hasText: customerName })
    await expect(customerOption).toBeVisible()
    await customerOption.click()

    await page.getByLabel('Produto').selectOption(String(productID))
    await page.getByLabel('Quantidade').fill('2')
    await expect(page.locator('.esmera-sales-fixed-price')).toContainText('123,45')

    const saleRequest = page.waitForResponse((response) => response.url().endsWith('/api/admin-sales') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Criar venda' }).click()
    const saleResponse = await saleRequest
    expect(saleResponse.ok(), `sale create failed: ${saleResponse.status()} ${await saleResponse.text()}`).toBeTruthy()
    const saleBody = await saleResponse.json() as {
      sale?: { id?: string | number; number?: string; status?: string; channel?: string; totalCents?: number }
    }
    expect(saleBody.sale?.id).toBeTruthy()
    expect(saleBody.sale?.status).toBe('confirmed')
    expect(saleBody.sale?.channel).toBe('whatsapp')
    expect(saleBody.sale?.totalCents).toBe(24_690)
    await expect(page.getByRole('heading', { name: 'Nova venda' })).toHaveCount(0)
    if (saleBody.sale?.number) await expect(page.getByText(saleBody.sale.number, { exact: false })).toBeVisible()

    await page.goto('http://localhost:3000/admin/categories')
    await page.getByRole('button', { name: 'Nova categoria' }).click()
    await expect(page.getByRole('heading', { name: 'Nova categoria' })).toBeVisible()
    await page.getByLabel('Nome').fill(categoryTitle)

    const categoryRequest = page.waitForResponse((response) => response.url().endsWith('/api/admin-categories') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Criar categoria' }).click()
    const categoryResponse = await categoryRequest
    expect(categoryResponse.ok(), `category create failed: ${categoryResponse.status()} ${await categoryResponse.text()}`).toBeTruthy()
    const categoryBody = await categoryResponse.json() as { id?: string | number }
    expect(categoryBody.id).toBeTruthy()
    await expect(page).toHaveURL(new RegExp(`/admin/categories\\?category=${categoryBody.id}(?:&|%26)tab=general`))

    const persistedResponse = await page.request.get(`http://localhost:3000/api/categories/${categoryBody.id}?draft=true&depth=0`)
    expect(persistedResponse.ok(), `category read failed: ${persistedResponse.status()} ${await persistedResponse.text()}`).toBeTruthy()
    const persisted = await persistedResponse.json() as { title?: string; slug?: string; status?: string; _status?: string }
    expect(persisted.title).toBe(categoryTitle)
    expect(persisted.slug).toBe(`categoria-popup-e2e-${stamp}`)
    expect(persisted.status).toBe('active')
    expect(persisted._status).toBe('draft')
  })
})
