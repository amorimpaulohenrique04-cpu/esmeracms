import { expect, Page, test } from '@playwright/test'

import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'
import { login } from '../helpers/login'

test.describe('Opportunity commercial source', () => {
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

  test('drives Pipeline, Dashboard and command search without reading Lead stages', async () => {
    test.setTimeout(120_000)
    const stamp = Date.now()
    const customerName = `Cliente Opportunity E2E ${stamp}`
    const nextAction = `Revisar proposta E2E ${stamp}`

    const customerResponse = await page.request.post('http://localhost:3000/api/admin-customers', {
      data: {
        action: 'create',
        force: true,
        data: {
          name: customerName,
          email: `opportunity-e2e-${stamp}@example.com`,
          origin: 'referral',
        },
      },
    })
    expect(customerResponse.ok(), `customer create failed: ${customerResponse.status()} ${await customerResponse.text()}`).toBeTruthy()
    const customer = await customerResponse.json() as { id?: string | number }
    expect(customer.id).toBeTruthy()

    const opportunityResponse = await page.request.post('http://localhost:3000/api/opportunities', {
      data: {
        customer: customer.id,
        source: 'referral',
        stage: 'proposal',
        priority: 'high',
        estimatedValueCents: 275_000,
        nextAction,
        nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    expect(opportunityResponse.ok(), `opportunity create failed: ${opportunityResponse.status()} ${await opportunityResponse.text()}`).toBeTruthy()
    const opportunity = await opportunityResponse.json() as { id?: string | number; code?: string; doc?: { id?: string | number; code?: string } }
    const opportunityId = opportunity.id ?? opportunity.doc?.id
    const opportunityCode = opportunity.code ?? opportunity.doc?.code
    expect(opportunityId).toBeTruthy()
    expect(opportunityCode).toMatch(/^OPP-/)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/admin/opportunities?view=pipeline')
    const opportunityLink = page.locator(`a[href="/admin/collections/opportunities/${opportunityId}"]`)
    const card = page.locator('article.esmera-opportunity-card').filter({ has: opportunityLink })
    await expect(card).toBeVisible()
    await expect(card).toContainText(customerName)
    await expect(card).toContainText(nextAction)
    await expect(card).toContainText('R$ 2.750,00')
    await expect(page.getByText('Fonte comercial: Opportunities.')).toBeVisible()
    await expect(page.getByText('Fonte transitória: leads.stage')).toHaveCount(0)

    await page.goto('http://localhost:3000/admin')
    await expect(page.getByText('Oportunidades abertas')).toBeVisible()
    await expect(page.getByText('Fonte: Opportunities.')).toBeVisible()

    const searchResponse = await page.request.get(`http://localhost:3000/api/admin-search?q=${encodeURIComponent(opportunityCode || '')}`)
    expect(searchResponse.ok()).toBeTruthy()
    const search = await searchResponse.json() as { results?: Array<{ id?: string; href?: string; group?: string }> }
    const expectedSearchHref = `/admin/opportunities?view=list&q=${encodeURIComponent(opportunityCode || String(opportunityId))}`
    expect(search.results?.some((item) => item.group === 'Oportunidades' && item.href === expectedSearchHref)).toBe(true)
  })
})
