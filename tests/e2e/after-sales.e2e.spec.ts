import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test.describe('Stage 10 After-sales workspace', () => {
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

  test('operates a real task, discrete shipment and occurrence from the queue', async () => {
    test.setTimeout(90_000)
    const stamp = Date.now()
    const customerName = `Cliente Pós-venda E2E ${stamp}`
    const taskTitle = `Confirmar recebimento E2E ${stamp}`
    const trackingCode = `TRACK-E2E-${stamp}`
    const occurrenceDescription = `Avaria documentada E2E ${stamp}`

    const customerResponse = await page.request.post('http://localhost:3000/api/customers', {
      data: { name: customerName, email: `pos-e2e-${stamp}@example.com` },
    })
    expect(customerResponse.ok(), await customerResponse.text()).toBeTruthy()
    const customer = await customerResponse.json() as { doc?: { id?: string | number }; id?: string | number }
    const customerId = customer.id ?? customer.doc?.id
    expect(customerId).toBeTruthy()

    const productResponse = await page.request.post('http://localhost:3000/api/products?draft=true', {
      data: {
        title: `Objeto Pós-venda E2E ${stamp}`,
        code: `POS-E2E-${stamp}`,
        slug: `objeto-pos-e2e-${stamp}`,
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 125000,
        _status: 'draft',
      },
    })
    expect(productResponse.ok(), await productResponse.text()).toBeTruthy()
    const product = await productResponse.json() as { doc?: { id?: string | number }; id?: string | number }
    const productId = product.id ?? product.doc?.id
    expect(productId).toBeTruthy()

    const saleResponse = await page.request.post('http://localhost:3000/api/sales', {
      data: {
        number: `SALE-E2E-${stamp}`,
        customer: customerId,
        channel: 'whatsapp',
        status: 'confirmed',
        items: [{ product: productId, quantity: 1 }],
        discountCents: 0,
        shippingCents: 0,
      },
    })
    expect(saleResponse.ok(), await saleResponse.text()).toBeTruthy()
    const sale = await saleResponse.json() as { doc?: { id?: string | number }; id?: string | number }
    const saleId = sale.id ?? sale.doc?.id
    expect(saleId).toBeTruthy()

    const caseResponse = await page.request.post('http://localhost:3000/api/after-sales', {
      data: {
        sale: saleId,
        customer: customerId,
        status: 'open',
        priority: 'high',
        summary: `Acompanhamento E2E ${stamp}`,
      },
    })
    expect(caseResponse.ok(), await caseResponse.text()).toBeTruthy()
    const afterSales = await caseResponse.json() as { doc?: { id?: string | number; caseNumber?: string }; id?: string | number; caseNumber?: string }
    const caseId = afterSales.id ?? afterSales.doc?.id
    const caseNumber = afterSales.caseNumber ?? afterSales.doc?.caseNumber
    expect(caseId).toBeTruthy()
    expect(caseNumber).toMatch(/^POS-/)

    const taskResponse = await page.request.post('http://localhost:3000/api/admin-after-sales', {
      data: {
        action: 'create-task',
        caseId,
        title: taskTitle,
        type: 'delivery_confirmation',
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        priority: 'high',
      },
    })
    expect(taskResponse.ok(), await taskResponse.text()).toBeTruthy()

    const shipmentResponse = await page.request.post('http://localhost:3000/api/admin-after-sales', {
      data: {
        action: 'create-shipment',
        caseId,
        carrier: 'Transportadora E2E',
        trackingCode,
        status: 'confirmed',
        estimatedDelivery: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        lastEvent: `Pedido confirmado E2E ${stamp}`,
      },
    })
    expect(shipmentResponse.ok(), await shipmentResponse.text()).toBeTruthy()

    const occurrenceResponse = await page.request.post('http://localhost:3000/api/admin-after-sales', {
      data: {
        action: 'create-occurrence',
        caseId,
        type: 'damage',
        severity: 'high',
        description: occurrenceDescription,
      },
    })
    expect(occurrenceResponse.ok(), await occurrenceResponse.text()).toBeTruthy()

    await page.goto(`http://localhost:3000/admin/after-sales?q=${encodeURIComponent(taskTitle)}&status=all`)
    await expect(page.getByRole('heading', { name: 'Pós-venda' }).first()).toBeVisible()
    await expect(page.getByRole('table', { name: 'Fila operacional de pós-venda' })).toBeVisible()
    const taskRow = page.getByRole('row').filter({ hasText: taskTitle })
    await expect(taskRow).toBeVisible()
    await taskRow.getByRole('button', { name: 'Inspecionar' }).click()
    await expect(page.getByRole('heading', { name: caseNumber })).toBeVisible()
    await expect(page.getByText(trackingCode, { exact: true })).toBeVisible()
    await expect(page.getByText(occurrenceDescription, { exact: true })).toBeVisible()
    await expect(page.getByText('Pedido confirmado', { exact: true })).toBeVisible()
    await expect(page.getByText('Entregue', { exact: true })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`http://localhost:3000/admin/after-sales?q=${encodeURIComponent(taskTitle)}&status=all`)
    const mobileRow = page.getByRole('row').filter({ hasText: taskTitle })
    await mobileRow.getByRole('button', { name: 'Inspecionar' }).click()
    await expect(page.getByRole('button', { name: 'Fechar inspector' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.getByRole('button', { name: 'Fechar inspector' }).click()
  })
})
