import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import {
  migrateCommercialLeadsToOpportunities,
  rollbackCommercialLeadOpportunityMigration,
} from '@/server/domain/opportunities/migration'
import type { Customer, Lead, Opportunity, Product, User } from '@/payload-types'

let payload: Payload
let commercialUser: User
const created = {
  users: [] as User['id'][],
  customers: [] as Customer['id'][],
  products: [] as Product['id'][],
  leads: [] as Lead['id'][],
  opportunities: [] as Opportunity['id'][],
}
const stamp = Date.now().toString(36)

async function deleteIDs(collection: 'activities' | 'opportunities' | 'leads' | 'customers' | 'products' | 'users', ids: Array<string | number>) {
  for (const id of [...ids].reverse()) {
    try {
      await payload.delete({ collection, id, overrideAccess: true })
    } catch {
      // A rollback or cascade may already have removed the record.
    }
  }
}

describe('Opportunity domain and Lead compatibility migration', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    commercialUser = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `opportunity-commercial-${stamp}@esmera.test`,
        password: 'test-password-123',
        name: `Opportunity Commercial ${stamp}`,
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
    await deleteIDs('opportunities', created.opportunities)
    await deleteIDs('leads', created.leads)
    await deleteIDs('products', created.products)
    await deleteIDs('customers', created.customers)
    await deleteIDs('users', created.users)
  }, 60_000)

  it('generates identity, validates transitions and records append-only stage history', async () => {
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente Opportunity ${stamp}`, email: `opportunity-customer-${stamp}@example.com` },
    })
    created.customers.push(customer.id)

    const opportunity = await payload.create({
      collection: 'opportunities',
      overrideAccess: true,
      user: commercialUser,
      data: {
        customer: customer.id,
        source: 'referral',
        stage: 'new',
        owner: commercialUser.id,
        nextAction: `Qualificar necessidade ${stamp}`,
      },
    })
    created.opportunities.push(opportunity.id)

    expect(opportunity.code).toMatch(/^OPP-[A-F0-9-]+$/)
    expect(opportunity.rank).toBeTypeOf('number')
    expect(opportunity.closedAt).toBeFalsy()

    const curation = await payload.update({
      collection: 'opportunities',
      id: opportunity.id,
      overrideAccess: true,
      user: commercialUser,
      data: { stage: 'curation' },
    })
    expect(curation.stage).toBe('curation')

    await payload.update({
      collection: 'opportunities',
      id: opportunity.id,
      overrideAccess: true,
      user: commercialUser,
      data: { stage: 'proposal' },
    })

    await expect(payload.update({
      collection: 'opportunities',
      id: opportunity.id,
      overrideAccess: true,
      user: commercialUser,
      data: { stage: 'lost' },
    })).rejects.toThrow()

    const lost = await payload.update({
      collection: 'opportunities',
      id: opportunity.id,
      overrideAccess: true,
      user: commercialUser,
      data: { stage: 'lost', lossReason: 'timing', lossNotes: `Retomar no próximo ciclo ${stamp}` },
    })
    expect(lost.stage).toBe('lost')
    expect(lost.closedAt).toBeTruthy()
    expect(lost.lossReason).toBe('timing')

    await expect(payload.update({
      collection: 'opportunities',
      id: opportunity.id,
      overrideAccess: true,
      user: commercialUser,
      data: { stage: 'proposal' },
    })).rejects.toThrow()

    await expect(payload.create({
      collection: 'opportunities',
      overrideAccess: true,
      user: commercialUser,
      data: { source: 'site', stage: 'won' },
    })).rejects.toThrow()

    const activities = await payload.find({
      collection: 'activities',
      overrideAccess: true,
      depth: 0,
      limit: 20,
      where: { opportunity: { equals: opportunity.id } },
    })
    expect(activities.docs.some((activity) => activity.eventType === 'opportunity.created')).toBe(true)
    expect(activities.docs.filter((activity) => activity.eventType === 'opportunity.stage_changed').length).toBeGreaterThanOrEqual(2)
  })

  it('migrates commercial Leads idempotently, links existing relations and supports safe rollback', async () => {
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente Migração ${stamp}`, email: `migration-${stamp}@example.com` },
    })
    created.customers.push(customer.id)

    const product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Produto Migração ${stamp}`,
        code: `MIG-${stamp}`.toUpperCase(),
        catalogStatus: 'archived',
        availability: 'available',
        priceMode: 'inquiry',
        _status: 'draft',
      },
    })
    created.products.push(product.id)

    const lead = await payload.create({
      collection: 'leads',
      overrideAccess: true,
      data: {
        name: `Lead Migração ${stamp}`,
        email: `MIGRATION-${stamp}@EXAMPLE.COM`,
        source: 'instagram',
        stage: 'curation',
        owner: commercialUser.id,
        interestedProducts: [product.id],
        nextAction: `Enviar curadoria ${stamp}`,
      },
    })
    created.leads.push(lead.id)

    const dryRun = await migrateCommercialLeadsToOpportunities(payload, { dryRun: true })
    expect(dryRun.created).toBe(1)
    expect(dryRun.linked).toBe(0)

    const first = await migrateCommercialLeadsToOpportunities(payload)
    expect(first.created).toBe(1)
    expect(first.linked).toBe(1)
    expect(first.skipped).toBe(0)

    const migratedLead = await payload.findByID({ collection: 'leads', id: lead.id, overrideAccess: true, depth: 0 })
    expect(migratedLead.opportunity).toBeTruthy()
    const opportunityID = typeof migratedLead.opportunity === 'object' ? migratedLead.opportunity.id : migratedLead.opportunity
    expect(opportunityID).toBeTruthy()
    created.opportunities.push(opportunityID as Opportunity['id'])

    const migrated = await payload.findByID({ collection: 'opportunities', id: opportunityID as string | number, overrideAccess: true, depth: 0 })
    expect(migrated.stage).toBe('curation')
    expect(String(migrated.customer)).toBe(String(customer.id))
    expect(migrated.interestedProducts?.map(String)).toContain(String(product.id))
    expect(migrated.estimatedValueCents).toBeNull()

    const second = await migrateCommercialLeadsToOpportunities(payload)
    expect(second.created).toBe(0)
    expect(second.reused).toBe(1)

    const rollback = await rollbackCommercialLeadOpportunityMigration(payload)
    expect(rollback.deleted).toBe(1)
    expect(rollback.unlinkedLeads).toBe(1)
    expect(rollback.skipped).toBe(0)

    const afterRollback = await payload.findByID({ collection: 'leads', id: lead.id, overrideAccess: true, depth: 0 })
    expect(afterRollback.opportunity).toBeFalsy()
    created.opportunities.length = 0
  }, 60_000)
})
