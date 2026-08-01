import { expect, Page, test } from '@playwright/test'

import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'
import { login } from '../helpers/login'

test.describe('Stage 9 operational Sales workspace', () => {
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

  test('moves, inspects and wins an Opportunity through the operational Pipeline', async () => {
    test.setTimeout(180_000)
    const stamp = Date.now()
    const customerName = `Cliente Pipeline ${stamp}`
    const productTitle = `Objeto Pipeline ${stamp}`

    const customerResponse = await page.request.post('http://localhost:3000/api/admin-customers', {
      data: {
        action: 'create',
        force: true,
        data: {
          name: customerName,
          email: `pipeline-${stamp}@example.com`,
          origin: 'whatsapp',
        },
      },
    })
    expect(customerResponse.ok(), await customerResponse.text()).toBeTruthy()
    const customer = await customerResponse.json() as { id?: string | number }
    expect(customer.id).toBeTruthy()

    const productResponse = await page.request.post('http://localhost:3000/api/products?draft=true', {
      data: {
        title: productTitle,
        code: `PIPE-${stamp}`,
        slug: `objeto-pipeline-${stamp}`,
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 320_000,
        _status: 'draft',
      },
    })
    expect(productResponse.ok(), await productResponse.text()).toBeTruthy()
    const productBody = await productResponse.json() as { id?: string | number; doc?: { id?: string | number } }
    const productId = productBody.id ?? productBody.doc?.id
    expect(productId).toBeTruthy()

    const opportunityResponse = await page.request.post('http://localhost:3000/api/opportunities', {
      data: {
        customer: customer.id,
        source: 'whatsapp',
        stage: 'proposal',
        priority: 'high',
        interestedProducts: [productId],
        estimatedValueCents: 320_000,
        nextAction: `Confirmar composição ${stamp}`,
        nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    expect(opportunityResponse.ok(), await opportunityResponse.text()).toBeTruthy()
    const opportunityBody = await opportunityResponse.json() as { id?: string | number; code?: string; doc?: { id?: string | number; code?: string } }
    const opportunityId = opportunityBody.id ?? opportunityBody.doc?.id
    const opportunityCode = opportunityBody.code ?? opportunityBody.doc?.code
    expect(opportunityId).toBeTruthy()
    expect(opportunityCode).toMatch(/^OPP-/)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`http://localhost:3000/admin/sales?view=pipeline&q=${encodeURIComponent(opportunityCode || '')}`)

    const card = page.locator('article.esmera-opportunity-card').filter({ hasText: opportunityCode })
    await expect(card).toBeVisible()
    await expect(card).toContainText(customerName)
    await expect(card).toContainText('R$ 3.200,00')

    await card.getByRole('button', { name: 'Inspecionar' }).click()
    await expect(page.getByRole('heading', { name: opportunityCode })).toBeVisible()
    await expect(page.getByText(productTitle)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Editar oportunidade' })).toBeVisible()
    await page.getByRole('button', { name: 'Fechar' }).click()

    await card.getByLabel(`Mover ${opportunityCode} para etapa`).selectOption('negotiation')
    await expect(page.getByRole('status')).toContainText('Etapa e ordem salvas.')
    await expect(card.getByLabel(`Mover ${opportunityCode} para etapa`)).toHaveValue('negotiation')

    await card.getByLabel(`Mover ${opportunityCode} para etapa`).selectOption('won')
    await expect(page.getByRole('heading', { name: 'Confirmar venda ganha' })).toBeVisible()
    await expect(page.getByText(productTitle)).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar e criar venda' }).click()
    await expect(page.getByRole('status')).toContainText(/Venda .* criada e oportunidade encerrada\./)
    await expect(card).toHaveCount(0)

    const salesParams = new URLSearchParams({ limit: '10', depth: '0' })
    salesParams.set('where[opportunity][equals]', String(opportunityId))
    const saleResponse = await page.request.get(`http://localhost:3000/api/sales?${salesParams.toString()}`)
    expect(saleResponse.ok(), await saleResponse.text()).toBeTruthy()
    const sales = await saleResponse.json() as { docs?: Array<{ id?: string | number; number?: string; status?: string; totalCents?: number; items?: Array<{ snapshotTitle?: string; unitPriceCents?: number }> }> }
    expect(sales.docs).toHaveLength(1)
    expect(sales.docs?.[0]?.status).toBe('confirmed')
    expect(sales.docs?.[0]?.totalCents).toBe(320_000)
    expect(sales.docs?.[0]?.items?.[0]?.snapshotTitle).toBe(productTitle)
    expect(sales.docs?.[0]?.items?.[0]?.unitPriceCents).toBe(320_000)

    await page.goto(`http://localhost:3000/admin/sales?view=list&stage=won&q=${encodeURIComponent(opportunityCode || '')}`)
    const row = page.getByRole('row').filter({ hasText: opportunityCode })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Ganho')
    await row.getByRole('button', { name: 'Inspecionar' }).click()
    await expect(page.getByText('Venda gerada')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Abrir venda' })).toBeVisible()
  })

  test('requires structured confirmation before marking an Opportunity as lost', async () => {
    test.setTimeout(120_000)
    const stamp = Date.now()
    const customerResponse = await page.request.post('http://localhost:3000/api/admin-customers', {
      data: {
        action: 'create',
        force: true,
        data: {
          name: `Cliente Perda ${stamp}`,
          email: `loss-${stamp}@example.com`,
          origin: 'referral',
        },
      },
    })
    expect(customerResponse.ok(), await customerResponse.text()).toBeTruthy()
    const customer = await customerResponse.json() as { id?: string | number }

    const opportunityResponse = await page.request.post('http://localhost:3000/api/opportunities', {
      data: {
        customer: customer.id,
        source: 'referral',
        stage: 'proposal',
        estimatedValueCents: 180_000,
        nextAction: `Aguardar retorno ${stamp}`,
      },
    })
    expect(opportunityResponse.ok(), await opportunityResponse.text()).toBeTruthy()
    const body = await opportunityResponse.json() as { id?: string | number; code?: string; doc?: { id?: string | number; code?: string } }
    const opportunityId = body.id ?? body.doc?.id
    const opportunityCode = body.code ?? body.doc?.code

    await page.goto(`http://localhost:3000/admin/sales?view=pipeline&q=${encodeURIComponent(opportunityCode || '')}`)
    const card = page.locator('article.esmera-opportunity-card').filter({ hasText: opportunityCode })
    await expect(card).toBeVisible()
    await card.getByLabel(`Mover ${opportunityCode} para etapa`).selectOption('lost')

    await expect(page.getByRole('heading', { name: 'Marcar como perdido' })).toBeVisible()
    await page.getByLabel('Motivo da perda').selectOption('budget')
    await page.getByLabel('Contexto').fill(`Orçamento não aprovado ${stamp}`)
    await page.getByRole('button', { name: 'Confirmar perda' }).click()
    await expect(page.getByRole('status')).toContainText('Oportunidade marcada como perdida.')
    await expect(card).toHaveCount(0)

    const stored = await page.request.get(`http://localhost:3000/api/opportunities/${opportunityId}?depth=0`)
    expect(stored.ok(), await stored.text()).toBeTruthy()
    const opportunity = await stored.json() as { stage?: string; lossReason?: string; lossNotes?: string; closedAt?: string }
    expect(opportunity.stage).toBe('lost')
    expect(opportunity.lossReason).toBe('budget')
    expect(opportunity.lossNotes).toContain(stamp.toString())
    expect(opportunity.closedAt).toBeTruthy()
  })
})
