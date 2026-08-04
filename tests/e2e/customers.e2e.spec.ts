import { expect, Page, test } from '@playwright/test'

import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'
import { login } from '../helpers/login'

test.describe('Customer relational workspace', () => {
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

  test('normalizes identity, detects duplicates and consolidates customer context', async () => {
    test.setTimeout(180_000)
    const stamp = Date.now()
    const customerName = `Cliente Relacional ${stamp}`
    const productTitle = `Objeto Cliente ${stamp}`
    const saleNumber = `CLI-${stamp}`
    const noteText = `Nota relacional ${stamp}`

    const productResponse = await page.request.post('http://localhost:3000/api/products?draft=true', {
      data: {
        title: productTitle,
        code: `CLI-PROD-${stamp}`,
        catalogStatus: 'archived',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 125_000,
        _status: 'draft',
      },
    })
    expect(productResponse.ok(), `product create failed: ${productResponse.status()} ${await productResponse.text()}`).toBeTruthy()
    const productBody = await productResponse.json() as { id?: string | number; doc?: { id?: string | number } }
    const productId = productBody.id ?? productBody.doc?.id
    expect(productId).toBeTruthy()

    const createResponse = await page.request.post('http://localhost:3000/api/admin-customers', {
      data: {
        action: 'create',
        force: true,
        data: {
          name: customerName,
          company: 'Atelier E2E',
          phone: '(11) 99999-1234',
          email: `CLIENTE.${stamp}@EXAMPLE.COM`,
          origin: 'instagram',
        },
      },
    })
    expect(createResponse.ok(), `customer create failed: ${createResponse.status()} ${await createResponse.text()}`).toBeTruthy()
    const createBody = await createResponse.json() as { id?: string | number }
    const customerId = createBody.id
    expect(customerId).toBeTruthy()

    const customerResponse = await page.request.get(`http://localhost:3000/api/customers/${customerId}`)
    expect(customerResponse.ok()).toBeTruthy()
    const customer = await customerResponse.json() as { phone?: string; email?: string; normalizedPhone?: string; normalizedEmail?: string }
    expect(customer.phone).toBe('+5511999991234')
    expect(customer.email).toBe(`cliente.${stamp}@example.com`)
    expect(customer.normalizedPhone).toBe('+5511999991234')
    expect(customer.normalizedEmail).toBe(`cliente.${stamp}@example.com`)

    const duplicateResponse = await page.request.post('http://localhost:3000/api/admin-customers', {
      data: {
        action: 'create',
        data: { name: `Duplicado ${stamp}`, phone: '+55 11 99999-1234', email: `cliente.${stamp}@example.com` },
      },
    })
    expect(duplicateResponse.status()).toBe(409)
    const duplicateBody = await duplicateResponse.json() as { candidates?: Array<{ id?: string | number }> }
    expect(duplicateBody.candidates?.some((candidate) => String(candidate.id) === String(customerId))).toBe(true)

    const saleResponse = await page.request.post('http://localhost:3000/api/sales', {
      data: {
        number: saleNumber,
        customer: customerId,
        channel: 'whatsapp',
        status: 'confirmed',
        items: [{ product: productId, quantity: 1 }],
        discountCents: 0,
        shippingCents: 0,
      },
    })
    expect(saleResponse.ok(), `sale create failed: ${saleResponse.status()} ${await saleResponse.text()}`).toBeTruthy()

    const interestResponse = await page.request.post('http://localhost:3000/api/admin-customers', {
      data: { action: 'add-interest', id: customerId, productId, note: 'Interesse explícito do teste.' },
    })
    expect(interestResponse.ok(), `interest create failed: ${interestResponse.status()} ${await interestResponse.text()}`).toBeTruthy()

    const noteResponse = await page.request.post('http://localhost:3000/api/admin-customers', {
      data: { action: 'add-note', id: customerId, note: noteText },
    })
    expect(noteResponse.ok(), `note create failed: ${noteResponse.status()} ${await noteResponse.text()}`).toBeTruthy()

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`http://localhost:3000/admin/customers?q=${encodeURIComponent(productTitle)}`)
    await expect(page.getByRole('link', { name: new RegExp(customerName) })).toBeVisible()

    await page.goto(`http://localhost:3000/admin/customers?customer=${customerId}&tab=overview`)
    await expect(page.getByRole('heading', { name: customerName })).toBeVisible()
    const customerTabs = page.getByRole('navigation', { name: 'Seções do cliente' })
    for (const tab of ['Visão geral', 'Histórico', 'Interesses', 'Vendas', 'Pós-venda', 'Notas']) {
      await expect(customerTabs.getByRole('link', { name: tab, exact: true })).toBeVisible()
    }
    await expect(page.getByText('R$ 1.250,00')).toBeVisible()
    await expect(page.getByText('Nenhuma negociação aberta')).toBeVisible()
    await expect(page.getByText('Disponível após a migração de Opportunities na Etapa 8')).toHaveCount(0)

    await page.goto(`http://localhost:3000/admin/customers?customer=${customerId}&tab=history`)
    await expect(page.getByText(noteText)).toBeVisible()
    await expect(page.getByText(`Interesse adicionado: ${productTitle}`)).toBeVisible()

    await page.goto(`http://localhost:3000/admin/customers?customer=${customerId}&tab=interests`)
    await expect(page.getByText(productTitle)).toBeVisible()
    await expect(page.getByLabel(`Status do interesse em ${productTitle}`)).toHaveValue('active')

    await page.goto(`http://localhost:3000/admin/customers?customer=${customerId}&tab=sales`)
    await expect(page.getByText(saleNumber)).toBeVisible()
    await expect(page.getByText('Confirmada', { exact: true })).toBeVisible()

    await page.goto(`http://localhost:3000/admin/customers?customer=${customerId}&tab=notes`)
    await expect(page.getByText(noteText)).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`http://localhost:3000/admin/customers?customer=${customerId}&tab=overview`)
    await expect(page.getByRole('link', { name: '← Clientes' })).toBeVisible()
    await expect(page.locator('.esmera-customer-master')).toBeHidden()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
