import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import {
  loseOpportunity,
  moveOpportunity,
  winOpportunity,
} from '@/server/domain/sales/opportunityWorkflow'
import type { Customer, Opportunity, Product, Sale, User } from '@/payload-types'

let payload: Payload
let commercialUser: User
const stamp = Date.now().toString(36)
const created = {
  users: [] as User['id'][],
  customers: [] as Customer['id'][],
  products: [] as Product['id'][],
  opportunities: [] as Opportunity['id'][],
  sales: [] as Sale['id'][],
}

async function remove(collection: 'sales' | 'opportunities' | 'products' | 'customers' | 'users', ids: Array<string | number>) {
  for (const id of [...ids].reverse()) {
    try {
      await payload.delete({ collection, id, overrideAccess: true } as never)
    } catch {
      // A transaction rollback or relation cleanup may already have removed the document.
    }
  }
}

describe('Stage 9 sales workflow', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    commercialUser = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `sales-workflow-${stamp}@esmera.test`,
        password: 'test-password-123',
        name: `Sales Workflow ${stamp}`,
        role: 'commercial',
      },
    })
    created.users.push(commercialUser.id)
  }, 180_000)

  afterAll(async () => {
    if (!payload) return
    await payload.delete({
      collection: 'activities',
      overrideAccess: true,
      where: { summary: { contains: stamp } },
    })
    await remove('sales', created.sales)
    await remove('opportunities', created.opportunities)
    await remove('products', created.products)
    await remove('customers', created.customers)
    await remove('users', created.users)
  }, 60_000)

  it('persists intermediate rank and creates Sale + snapshots atomically when won', async () => {
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente Venda ${stamp}`, email: `sale-${stamp}@example.com` },
    })
    created.customers.push(customer.id)

    const product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Objeto Venda ${stamp}`,
        code: `SALE-${stamp}`.toUpperCase(),
        slug: `objeto-venda-${stamp}`,
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 250_000,
        _status: 'draft',
      },
    })
    created.products.push(product.id)

    const opportunity = await payload.create({
      collection: 'opportunities',
      overrideAccess: true,
      user: commercialUser,
      draft: true,
      data: {
        customer: customer.id,
        source: 'whatsapp',
        stage: 'proposal',
        owner: commercialUser.id,
        interestedProducts: [product.id],
        estimatedValueCents: 275_000,
        nextAction: `Fechar venda ${stamp}`,
      },
    })
    created.opportunities.push(opportunity.id)

    const moved = await moveOpportunity(payload, commercialUser, {
      id: opportunity.id,
      toStage: 'negotiation',
      sourceStage: 'proposal',
      sourceOrderedIds: [],
      targetOrderedIds: [opportunity.id],
    })
    expect(moved.opportunity.stage).toBe('negotiation')
    expect(moved.opportunity.rank).toBeTypeOf('number')

    const won = await winOpportunity(payload, commercialUser, {
      id: opportunity.id,
      channel: 'whatsapp',
      items: [{ product: product.id, quantity: 1 }],
      discountCents: 10_000,
      shippingCents: 5_000,
    })
    created.sales.push(won.sale.id)

    expect(won.sale.status).toBe('confirmed')
    expect(won.sale.subtotalCents).toBe(250_000)
    expect(won.sale.totalCents).toBe(245_000)
    expect(won.sale.items?.[0]?.snapshotTitle).toBe(product.title)
    expect(won.sale.items?.[0]?.snapshotSlug).toBe(product.slug)
    expect(won.sale.items?.[0]?.unitPriceCents).toBe(250_000)

    const updated = await payload.findByID({ collection: 'opportunities', id: opportunity.id, overrideAccess: true, depth: 0 })
    expect(updated.stage).toBe('won')
    expect(updated.closedAt).toBeTruthy()
    expect(String(typeof updated.wonSale === 'object' ? updated.wonSale?.id : updated.wonSale)).toBe(String(won.sale.id))

    const events = await payload.find({
      collection: 'activities',
      overrideAccess: true,
      depth: 0,
      limit: 20,
      where: { opportunity: { equals: opportunity.id } },
    })
    expect(events.docs.some((event) => event.eventType === 'opportunity.stage_changed' && event.toStage === 'won')).toBe(true)
    expect(events.docs.some((event) => event.eventType === 'sale.created')).toBe(true)
  }, 60_000)

  it('rolls back Sale creation when an inquiry item has no negotiated price', async () => {
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente Rollback ${stamp}`, email: `rollback-${stamp}@example.com` },
    })
    created.customers.push(customer.id)

    const product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Objeto Consulta ${stamp}`,
        code: `INQ-${stamp}`.toUpperCase(),
        slug: `objeto-consulta-${stamp}`,
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'inquiry',
        _status: 'draft',
      },
    })
    created.products.push(product.id)

    const opportunity = await payload.create({
      collection: 'opportunities',
      overrideAccess: true,
      user: commercialUser,
      draft: true,
      data: { customer: customer.id, source: 'referral', stage: 'proposal', interestedProducts: [product.id] },
    })
    created.opportunities.push(opportunity.id)

    const before = await payload.count({ collection: 'sales', overrideAccess: true })
    await expect(winOpportunity(payload, commercialUser, {
      id: opportunity.id,
      channel: 'referral',
      items: [{ product: product.id, quantity: 1 }],
    })).rejects.toThrow()
    const after = await payload.count({ collection: 'sales', overrideAccess: true })
    expect(after.totalDocs).toBe(before.totalDocs)

    const unchanged = await payload.findByID({ collection: 'opportunities', id: opportunity.id, overrideAccess: true, depth: 0 })
    expect(unchanged.stage).toBe('proposal')
    expect(unchanged.wonSale).toBeFalsy()

    const lost = await loseOpportunity(payload, commercialUser, {
      id: opportunity.id,
      lossReason: 'budget',
      lossNotes: `Sem orçamento confirmado ${stamp}`,
    })
    expect(lost.opportunity.stage).toBe('lost')
    expect(lost.opportunity.lossReason).toBe('budget')
  }, 60_000)
})
