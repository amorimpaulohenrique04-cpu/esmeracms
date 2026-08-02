import type { Payload, Where } from 'payload'

import {
  migratedLeadStages,
  migratedOpportunityCode,
  OPPORTUNITY_MIGRATION_VERSION,
  type OpportunityStage,
} from '../../../businessRules/opportunities/stages'
import { relationshipID, type RelationshipValue } from '../../../businessRules/relationships'
import { normalizeCustomerEmail, normalizeCustomerPhone } from '../../../businessRules/customers/normalization'

type LegacyLead = {
  id: string | number
  name?: string | null
  email?: string | null
  phone?: string | null
  source?: string | null
  stage?: string | null
  owner?: RelationshipValue
  customer?: RelationshipValue
  opportunity?: RelationshipValue
  interestedProducts?: RelationshipValue[] | null
  nextAction?: string | null
  nextActionAt?: string | null
  closedAt?: string | null
  lossReason?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

type MigratedOpportunity = {
  id: string | number
  code?: string | null
  stage?: string | null
  customer?: RelationshipValue
  interestedProducts?: RelationshipValue[] | null
  wonSale?: RelationshipValue
  sourceLead?: RelationshipValue
  migrationVersion?: string | null
}

export type OpportunityMigrationIssue = {
  leadId?: string | number
  opportunityId?: string | number
  message: string
}

export type OpportunityMigrationReport = {
  version: string
  dryRun: boolean
  scanned: number
  created: number
  reused: number
  linked: number
  skipped: number
  issues: OpportunityMigrationIssue[]
}

export type OpportunityRollbackReport = {
  version: string
  scanned: number
  deleted: number
  unlinkedLeads: number
  skipped: number
  issues: OpportunityMigrationIssue[]
}

const validStages = new Set<string>(migratedLeadStages)
const stageWeight: Record<OpportunityStage, number> = {
  new: 0,
  curation: 1,
  proposal: 2,
  negotiation: 3,
  won: 4,
  lost: 5,
}

function relationIDs(values: RelationshipValue[] | null | undefined) {
  return (values || []).map(relationshipID).filter((id): id is string | number => id !== null)
}

async function allDocs<T>(payload: Payload, collection: string, where?: Where): Promise<T[]> {
  const docs: T[] = []
  let page = 1
  while (true) {
    const result = await payload.find({
      collection: collection as never,
      depth: 0,
      limit: 500,
      page,
      overrideAccess: true,
      sort: 'updatedAt',
      where,
    } as never) as unknown as { docs: T[]; hasNextPage?: boolean }
    docs.push(...result.docs)
    if (!result.hasNextPage) break
    page += 1
  }
  return docs
}

async function matchingCustomer(payload: Payload, lead: LegacyLead) {
  const direct = relationshipID(lead.customer)
  if (direct !== null) return { id: direct, ambiguous: false }

  const email = normalizeCustomerEmail(lead.email)
  const phone = normalizeCustomerPhone(lead.phone)
  const or: Where[] = []
  if (email) or.push({ normalizedEmail: { equals: email } } as Where, { email: { equals: email } } as Where)
  if (phone) or.push({ normalizedPhone: { equals: phone } } as Where, { phone: { equals: phone } } as Where)
  if (!or.length) return { id: null, ambiguous: false }

  const result = await payload.find({
    collection: 'customers',
    depth: 0,
    limit: 3,
    pagination: false,
    overrideAccess: true,
    where: { or } as Where,
  })

  if (result.docs.length === 1) return { id: result.docs[0].id, ambiguous: false }
  return { id: null, ambiguous: result.docs.length > 1 }
}

async function existingOpportunity(payload: Payload, leadID: string | number) {
  const code = migratedOpportunityCode(leadID)
  const result = await payload.find({
    collection: 'opportunities',
    depth: 0,
    limit: 2,
    pagination: false,
    overrideAccess: true,
    where: {
      or: [
        { sourceLead: { equals: leadID } },
        { code: { equals: code } },
      ],
    } as Where,
  })
  return result.docs[0] as unknown as MigratedOpportunity | undefined
}

function migrationData(lead: LegacyLead, customerID: string | number | null, ordinal: number) {
  const stage = validStages.has(String(lead.stage)) ? lead.stage as OpportunityStage : 'curation'
  const products = relationIDs(lead.interestedProducts)
  return {
    code: migratedOpportunityCode(lead.id),
    customer: customerID,
    source: lead.source || 'other',
    stage,
    rank: stageWeight[stage] * 1_000_000 + ordinal * 1_000,
    owner: relationshipID(lead.owner),
    priority: 'normal',
    interestedProducts: products,
    estimatedValueCents: null,
    nextAction: lead.nextAction || null,
    nextActionAt: lead.nextActionAt || null,
    expectedCloseAt: null,
    closedAt: lead.closedAt || null,
    lossReason: stage === 'lost' ? 'other' : null,
    lossNotes: stage === 'lost' ? lead.lossReason || 'Motivo legado não estruturado.' : null,
    sourceLead: lead.id,
    migrationVersion: OPPORTUNITY_MIGRATION_VERSION,
    migratedAt: new Date().toISOString(),
  }
}

async function ensureMigrationActivity(payload: Payload, lead: LegacyLead, opportunity: MigratedOpportunity) {
  const existing = await payload.find({
    collection: 'activities',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: {
      and: [
        { eventType: { equals: 'opportunity.migrated' } },
        { opportunity: { equals: opportunity.id } },
      ],
    } as Where,
  })
  if (existing.docs.length) return

  const relatedTo: Array<{ relationTo: 'leads' | 'opportunities' | 'customers'; value: string | number }> = [
    { relationTo: 'leads', value: lead.id },
    { relationTo: 'opportunities', value: opportunity.id },
  ]
  const customerID = relationshipID(opportunity.customer)
  if (customerID !== null) relatedTo.push({ relationTo: 'customers', value: customerID })

  await payload.create({
    collection: 'activities',
    overrideAccess: true,
    context: { skipOpportunityActivity: true },
    data: {
      eventType: 'opportunity.migrated',
      kind: 'stage_change',
      occurredAt: new Date().toISOString(),
      summary: `Lead ${lead.name || lead.id} migrado para ${opportunity.code || opportunity.id}`,
      details: `Migração idempotente ${OPPORTUNITY_MIGRATION_VERSION}. O Lead permanece como camada de compatibilidade.`,
      owner: relationshipID(lead.owner) || undefined,
      opportunity: opportunity.id,
      toStage: opportunity.stage || lead.stage || undefined,
      lossReason: opportunity.stage === 'lost' ? 'other' : undefined,
      relatedTo,
    } as never,
  })
}

async function linkLead(payload: Payload, lead: LegacyLead, opportunityID: string | number, migratedAt: string) {
  if (String(relationshipID(lead.opportunity) ?? '') === String(opportunityID)) return false
  await payload.update({
    collection: 'leads',
    id: lead.id,
    overrideAccess: true,
    data: { opportunity: opportunityID, opportunityMigratedAt: migratedAt } as never,
  })
  return true
}

export async function migrateCommercialLeadsToOpportunities(payload: Payload, options: { dryRun?: boolean } = {}): Promise<OpportunityMigrationReport> {
  const dryRun = options.dryRun === true
  const report: OpportunityMigrationReport = {
    version: OPPORTUNITY_MIGRATION_VERSION,
    dryRun,
    scanned: 0,
    created: 0,
    reused: 0,
    linked: 0,
    skipped: 0,
    issues: [],
  }

  const leads = await allDocs<LegacyLead>(payload, 'leads', { stage: { in: [...migratedLeadStages] } } as Where)
  report.scanned = leads.length

  for (const [index, lead] of leads.entries()) {
    const stage = String(lead.stage || '')
    if (!validStages.has(stage)) {
      report.skipped += 1
      report.issues.push({ leadId: lead.id, message: `Etapa legada não migrável: ${stage || 'vazia'}.` })
      continue
    }

    const customer = await matchingCustomer(payload, lead)
    if (customer.ambiguous) {
      report.issues.push({ leadId: lead.id, message: 'Mais de um Customer coincide com telefone/e-mail; vínculo não foi inferido.' })
    }
    if (stage === 'won' && customer.id === null) {
      report.skipped += 1
      report.issues.push({ leadId: lead.id, message: 'Lead ganho sem Customer inequívoco. Corrija o vínculo antes de migrar.' })
      continue
    }

    const existing = await existingOpportunity(payload, lead.id)
    if (existing) {
      report.reused += 1
      if (!dryRun) {
        const migratedAt = new Date().toISOString()
        if (await linkLead(payload, lead, existing.id, migratedAt)) report.linked += 1
        await ensureMigrationActivity(payload, lead, existing)
      }
      continue
    }

    if (dryRun) {
      report.created += 1
      continue
    }

    const data = migrationData(lead, customer.id, index + 1)
    const opportunity = await payload.create({
      collection: 'opportunities',
      overrideAccess: true,
      context: { skipOpportunityActivity: true, allowMissingLegacyClosedAt: true },
      data: data as never,
    }) as unknown as MigratedOpportunity

    report.created += 1
    if (await linkLead(payload, lead, opportunity.id, String(data.migratedAt))) report.linked += 1
    await ensureMigrationActivity(payload, lead, opportunity)
  }

  return report
}

export async function rollbackCommercialLeadOpportunityMigration(payload: Payload): Promise<OpportunityRollbackReport> {
  const report: OpportunityRollbackReport = {
    version: OPPORTUNITY_MIGRATION_VERSION,
    scanned: 0,
    deleted: 0,
    unlinkedLeads: 0,
    skipped: 0,
    issues: [],
  }

  const opportunities = await allDocs<MigratedOpportunity>(payload, 'opportunities', {
    migrationVersion: { equals: OPPORTUNITY_MIGRATION_VERSION },
  } as Where)
  report.scanned = opportunities.length

  for (const opportunity of opportunities) {
    const linkedSales = await payload.count({
      collection: 'sales',
      overrideAccess: true,
      where: { opportunity: { equals: opportunity.id } } as Where,
    })
    if (linkedSales.totalDocs > 0 || relationshipID(opportunity.wonSale) !== null) {
      report.skipped += 1
      report.issues.push({ opportunityId: opportunity.id, message: 'Rollback bloqueado: a oportunidade já possui Sale relacionada.' })
      continue
    }

    const leadID = relationshipID(opportunity.sourceLead)
    if (leadID !== null) {
      await payload.update({
        collection: 'leads',
        id: leadID,
        overrideAccess: true,
        data: { opportunity: null, opportunityMigratedAt: null } as never,
      })
      report.unlinkedLeads += 1
    }

    await payload.delete({
      collection: 'activities',
      overrideAccess: true,
      where: {
        and: [
          { eventType: { equals: 'opportunity.migrated' } },
          { opportunity: { equals: opportunity.id } },
        ],
      } as Where,
    })
    await payload.delete({ collection: 'opportunities', id: opportunity.id, overrideAccess: true })
    report.deleted += 1
  }

  return report
}
