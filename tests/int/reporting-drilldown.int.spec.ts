import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@/payload.config'
import type { Category, Customer, Opportunity, Product, Sale, User } from '@/payload-types'
import { getReportingDrilldown } from '@/server/reporting'

let payload: Payload
let user: User
let category: Category
let customer: Customer
let product: Product
let opportunity: Opportunity
let sale: Sale

const stamp = `reporting-drilldown-${Date.now().toString(36)}`

function requestFor(): PayloadRequest {
  return { payload, user } as PayloadRequest
}

function period() {
  return {
    from: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    to: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }
}

describe('Reporting Service drill-downs', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `${stamp}@esmera.test`,
        password: 'test-password-123',
        name: 'Reporting Drill-down',
        role: 'commercial',
      },
    })

    category = await payload.create({
      collection: 'categories',
      overrideAccess: true,
      data: {
        title: `Categoria ${stamp}`,
        slug: `categoria-${stamp}`,
        status: 'active',
        _status: 'published',
      },
    })

    customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente ${stamp}`, email: `${stamp}@example.com` },
    })

    product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Produto ${stamp}`,
        slug: `produto-${stamp}`,
        code: `RDD-${stamp}`.toUpperCase(),
        catalogStatus: 'active',
        availability: 'available',
        categories: [category.id],
        priceMode: 'fixed',
        basePriceCents: 20_000,
      },
    })

    opportunity = await payload.create({
      collection: 'opportunities',
      overrideAccess: true,
      data: {
        customer: customer.id,
        source: 'site',
        stage: 'new',
        owner: user.id,
        priority: 'normal',
        interestedProducts: [product.id],
      } as never,
    })
    opportunity = await payload.update({
      collection: 'opportunities',
      id: opportunity.id,
      overrideAccess: true,
      data: { stage: 'curation' },
    })
    opportunity = await payload.update({
      collection: 'opportunities',
      id: opportunity.id,
      overrideAccess: true,
      data: { stage: 'proposal' },
    })
    opportunity = await payload.update({
      collection: 'opportunities',
      id: opportunity.id,
      overrideAccess: true,
      context: { skipOpportunityWonAutomation: true },
      data: { stage: 'won', customer: customer.id },
    })

    sale = await payload.create({
      collection: 'sales',
      overrideAccess: true,
      context: { skipJobScheduling: true },
      data: {
        number: `RDD-${stamp}`.toUpperCase(),
        customer: customer.id,
        opportunity: opportunity.id,
        owner: user.id,
        channel: 'site',
        status: 'confirmed',
        items: [{ product: product.id, quantity: 1 }],
      } as never,
    })
  }, 180_000)

  afterAll(async () => {
    if (!payload) return
    if (sale) await payload.delete({ collection: 'sales', id: sale.id, overrideAccess: true })
    if (opportunity) {
      const activities = await payload.find({
        collection: 'activities',
        overrideAccess: true,
        pagination: false,
        limit: 100,
        where: { opportunity: { equals: opportunity.id } } as never,
      })
      for (const activity of activities.docs) {
        await payload.delete({ collection: 'activities', id: activity.id, overrideAccess: true })
      }
      await payload.delete({ collection: 'opportunities', id: opportunity.id, overrideAccess: true })
    }
    if (customer) await payload.delete({ collection: 'customers', id: customer.id, overrideAccess: true })
    if (product) await payload.delete({ collection: 'products', id: product.id, overrideAccess: true })
    if (category) await payload.delete({ collection: 'categories', id: category.id, overrideAccess: true })
    if (user) await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  }, 60_000)

  it('opens product, category, owner and source recuts with real records', async () => {
    const filters = { period: period() }
    const productResult = await getReportingDrilldown(requestFor(), filters, 'product', String(product.id))
    const categoryResult = await getReportingDrilldown(requestFor(), filters, 'category', String(category.id))
    const ownerResult = await getReportingDrilldown(requestFor(), filters, 'owner', String(user.id))
    const sourceResult = await getReportingDrilldown(requestFor(), filters, 'source', 'site')

    expect(productResult.records.map((record) => record.entity).sort()).toEqual(['opportunity', 'sale'])
    expect(categoryResult.records.map((record) => record.entity).sort()).toEqual(['opportunity', 'sale'])
    expect(ownerResult.records.map((record) => record.entity).sort()).toEqual(['opportunity', 'sale'])
    expect(sourceResult.records).toHaveLength(1)
    expect(sourceResult.records[0]?.href).toContain('/admin/collections/opportunities/')
  })
})
