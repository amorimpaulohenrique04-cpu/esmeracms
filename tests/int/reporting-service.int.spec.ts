import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@/payload.config'
import type { Customer, Lead, Opportunity, Product, Sale, User } from '@/payload-types'
import {
  getDashboardReporting,
  getReportingOverview,
  getReportingSnapshot,
  ReportingAccessError,
} from '@/server/reporting'

let payload: Payload
let commercialUser: User
let editorUser: User
let customer: Customer
let product: Product
let lead: Lead
let wonOpportunity: Opportunity
let lostOpportunity: Opportunity
let openOpportunity: Opportunity
let sale: Sale

const stamp = `reporting-${Date.now().toString(36)}`
const createdUserIDs: User['id'][] = []

function requestFor(user: User): PayloadRequest {
  return { payload, user } as PayloadRequest
}

async function createUser(role: 'editor' | 'commercial') {
  const user = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: `${stamp}-${role}@esmera.test`,
      password: 'test-password-123',
      name: `Reporting ${role}`,
      role,
    },
  })
  createdUserIDs.push(user.id)
  return user
}

async function moveOpportunity(opportunity: Opportunity, stage: Opportunity['stage'], extra: Record<string, unknown> = {}) {
  return await payload.update({
    collection: 'opportunities',
    id: opportunity.id,
    overrideAccess: true,
    context: stage === 'won' ? { skipOpportunityWonAutomation: true } : undefined,
    data: { stage, ...extra } as never,
  })
}

describe('Reporting Service semantic contract', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    commercialUser = await createUser('commercial')
    editorUser = await createUser('editor')

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
        code: `REP-${stamp}`.toUpperCase(),
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 10_000,
      },
    })

    lead = await payload.create({
      collection: 'leads',
      overrideAccess: true,
      data: {
        name: `Lead ${stamp}`,
        email: `lead-${stamp}@example.com`,
        source: 'site',
        stage: 'new',
        owner: commercialUser.id,
      },
    })

    wonOpportunity = await payload.create({
      collection: 'opportunities',
      overrideAccess: true,
      data: {
        customer: customer.id,
        source: 'site',
        stage: 'new',
        owner: commercialUser.id,
        priority: 'normal',
        interestedProducts: [product.id],
      } as never,
    })
    wonOpportunity = await moveOpportunity(wonOpportunity, 'curation')
    wonOpportunity = await moveOpportunity(wonOpportunity, 'proposal')
    wonOpportunity = await moveOpportunity(wonOpportunity, 'won', { customer: customer.id })

    lostOpportunity = await payload.create({
      collection: 'opportunities',
      overrideAccess: true,
      data: {
        source: 'instagram',
        stage: 'new',
        owner: commercialUser.id,
        priority: 'normal',
        interestedProducts: [product.id],
      } as never,
    })
    lostOpportunity = await moveOpportunity(lostOpportunity, 'lost', { lossReason: 'timing' })

    openOpportunity = await payload.create({
      collection: 'opportunities',
      overrideAccess: true,
      data: {
        customer: customer.id,
        source: 'site',
        stage: 'new',
        owner: commercialUser.id,
        priority: 'normal',
        interestedProducts: [product.id],
      } as never,
    })
    openOpportunity = await moveOpportunity(openOpportunity, 'curation')
    openOpportunity = await moveOpportunity(openOpportunity, 'proposal')

    sale = await payload.create({
      collection: 'sales',
      overrideAccess: true,
      context: { skipJobScheduling: true },
      data: {
        number: `REPORT-${stamp}`.toUpperCase(),
        customer: customer.id,
        opportunity: wonOpportunity.id,
        owner: commercialUser.id,
        channel: 'site',
        status: 'confirmed',
        items: [{ product: product.id, quantity: 1 }],
      } as never,
    })
  }, 180_000)

  afterAll(async () => {
    if (!payload) return
    if (sale) await payload.delete({ collection: 'sales', id: sale.id, overrideAccess: true })

    const opportunityIDs = [openOpportunity, lostOpportunity, wonOpportunity]
      .filter(Boolean)
      .map((opportunity) => opportunity.id)
    if (opportunityIDs.length) {
      const activities = await payload.find({
        collection: 'activities',
        overrideAccess: true,
        limit: 100,
        pagination: false,
        where: { opportunity: { in: opportunityIDs } } as never,
      })
      for (const activity of activities.docs) {
        await payload.delete({ collection: 'activities', id: activity.id, overrideAccess: true })
      }
    }

    for (const opportunity of [openOpportunity, lostOpportunity, wonOpportunity]) {
      if (opportunity) await payload.delete({ collection: 'opportunities', id: opportunity.id, overrideAccess: true })
    }
    if (lead) await payload.delete({ collection: 'leads', id: lead.id, overrideAccess: true })
    if (customer) await payload.delete({ collection: 'customers', id: customer.id, overrideAccess: true })
    if (product) await payload.delete({ collection: 'products', id: product.id, overrideAccess: true })
    for (const id of createdUserIDs.reverse()) {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    }
  }, 60_000)

  it('centralizes opportunities, valid sales, revenue, conversion, ticket and cycle', async () => {
    const from = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const to = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const result = await getReportingOverview(requestFor(commercialUser), {
      period: { from, to },
      compareWith: 'previous_period',
      ownerId: commercialUser.id,
    })

    expect(result.metrics.current.opportunitiesCreated).toBe(3)
    expect(result.metrics.current.validSales).toBe(1)
    expect(result.metrics.current.revenueCents).toBe(10_000)
    expect(result.metrics.current.wonOpportunities).toBe(1)
    expect(result.metrics.current.lostOpportunities).toBe(1)
    expect(result.metrics.current.conversionRate).toBe(0.5)
    expect(result.metrics.current.averageTicketCents).toBe(10_000)
    expect(result.metrics.current.averageSalesCycleDays).not.toBeNull()
    expect(result.metrics.previous?.opportunitiesCreated).toBe(0)
    expect(result.leadAcquisition.total).toBe(1)
    expect(result.leadAcquisition.sources.find((row) => row.source === 'site')?.leads).toBe(1)
    expect(result.channels.find((row) => row.channel === 'site')?.sales).toBe(1)
    expect(result.sources.find((row) => row.source === 'site')?.opportunitiesCreated).toBe(2)
  })

  it('derives stage conversion and drop-off from structured Activities', async () => {
    const result = await getReportingSnapshot(requestFor(commercialUser), {
      period: {
        from: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        to: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
      ownerId: commercialUser.id,
    })

    expect(result.funnel.historySource).toBe('activities')
    expect(result.funnel.stages.find((row) => row.stage === 'new')).toMatchObject({
      volume: 3,
      progressed: 2,
      dropOff: 1,
    })
    expect(result.funnel.stages.find((row) => row.stage === 'proposal')).toMatchObject({
      volume: 2,
      progressed: 1,
      dropOff: 0,
    })
    expect(result.funnel.lost).toBe(1)
    expect(result.losses.find((row) => row.reason === 'timing')?.volume).toBe(1)
  })

  it('provides the dashboard subset without duplicating metric semantics', async () => {
    const result = await getDashboardReporting(requestFor(commercialUser), {
      period: {
        from: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        to: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
      ownerId: commercialUser.id,
    })

    expect(result.sales.validSales).toBe(1)
    expect(result.sales.revenueCents).toBe(10_000)
    expect(result.sales.averageTicketCents).toBe(10_000)
    expect(result.openOpportunities).toBe(1)
    expect(result.pipeline.find((row) => row.stage === 'proposal')?.volume).toBe(1)
  })

  it('rejects editor access and keeps commercial access explicit', async () => {
    await expect(
      getReportingSnapshot(requestFor(editorUser), {
        period: {
          from: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          to: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      }),
    ).rejects.toBeInstanceOf(ReportingAccessError)
  })
})
