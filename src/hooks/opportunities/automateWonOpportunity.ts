import { randomUUID } from 'node:crypto'

import type { CollectionAfterChangeHook } from 'payload'

import { relationshipID } from '../../businessRules/relationships'

type OpportunityDocument = {
  id: string | number
  code?: string | null
  stage?: string | null
  customer?: unknown
  owner?: unknown
  source?: string | null
  priority?: string | null
  interestedProducts?: unknown[] | null
  estimatedValueCents?: number | null
  nextAction?: string | null
  wonSale?: unknown
}

const DAY_MS = 86_400_000

function saleNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `ESM-${date}-${randomUUID().slice(0, 6).toUpperCase()}`
}

function channel(source: string | null | undefined) {
  return ['whatsapp', 'instagram', 'site', 'referral', 'architect'].includes(String(source)) ? source : 'other'
}

async function findSale(req: Parameters<CollectionAfterChangeHook>[0]['req'], opportunityID: string | number) {
  const result = await req.payload.find({
    collection: 'sales',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where: { opportunity: { equals: opportunityID } },
  })
  return result.docs[0]
}

async function ensureSale(req: Parameters<CollectionAfterChangeHook>[0]['req'], opportunity: OpportunityDocument) {
  const linkedSaleID = relationshipID(opportunity.wonSale)
  if (linkedSaleID !== null) return await req.payload.findByID({ collection: 'sales', id: linkedSaleID, depth: 0, overrideAccess: true, req })
  const existing = await findSale(req, opportunity.id)
  if (existing) return existing

  const customerID = relationshipID(opportunity.customer)
  if (customerID === null) throw new Error('A oportunidade ganha precisa de cliente para gerar a venda.')
  const productIDs = (opportunity.interestedProducts || []).map(relationshipID).filter((id): id is string | number => id !== null)

  try {
    return await req.payload.create({
      collection: 'sales',
      overrideAccess: true,
      req,
      context: { skipJobScheduling: true },
      data: {
        number: saleNumber(),
        customer: customerID,
        opportunity: opportunity.id,
        channel: channel(opportunity.source),
        status: 'draft',
        owner: relationshipID(opportunity.owner) || undefined,
        items: productIDs.map((product) => ({ product, quantity: 1 })),
        discountCents: 0,
        shippingCents: 0,
        deliveryNotes: opportunity.nextAction?.trim() || null,
      } as never,
    })
  } catch (error) {
    const concurrent = await findSale(req, opportunity.id)
    if (concurrent) return concurrent
    throw error
  }
}

async function ensureAfterSales(req: Parameters<CollectionAfterChangeHook>[0]['req'], opportunity: OpportunityDocument, saleID: string | number) {
  const existing = await req.payload.find({
    collection: 'after-sales', depth: 0, limit: 1, pagination: false, overrideAccess: true, req,
    where: { sale: { equals: saleID } },
  })
  if (existing.docs[0]) return existing.docs[0]
  const customerID = relationshipID(opportunity.customer)
  if (customerID === null) throw new Error('A oportunidade ganha precisa de cliente para abrir o pós-venda.')
  return await req.payload.create({
    collection: 'after-sales', overrideAccess: true, req,
    data: {
      sale: saleID,
      customer: customerID,
      owner: relationshipID(opportunity.owner) || undefined,
      status: 'open',
      priority: opportunity.priority || 'normal',
      summary: `Acompanhamento criado a partir de ${opportunity.code || opportunity.id}.${opportunity.nextAction ? ` Próxima ação registrada: ${opportunity.nextAction}` : ''}`,
    } as never,
  })
}

async function ensureOnboardingTask(req: Parameters<CollectionAfterChangeHook>[0]['req'], opportunity: OpportunityDocument, saleID: string | number, afterSalesID: string | number) {
  const automationKey = `opportunity:${opportunity.id}:won-onboarding:v1`
  const existing = await req.payload.find({
    collection: 'tasks', depth: 0, limit: 1, pagination: false, overrideAccess: true, req,
    where: { automationKey: { equals: automationKey } },
  })
  if (existing.docs[0]) return existing.docs[0]
  const customerID = relationshipID(opportunity.customer)
  return await req.payload.create({
    collection: 'tasks', overrideAccess: true, req,
    data: {
      automationKey,
      title: 'Realizar contato de onboarding / confirmação de pedido',
      type: 'delivery_confirmation',
      status: 'pending',
      priority: opportunity.priority || 'normal',
      dueAt: new Date(Date.now() + DAY_MS).toISOString(),
      assignee: relationshipID(opportunity.owner) || undefined,
      relatedTo: [
        { relationTo: 'opportunities', value: opportunity.id },
        { relationTo: 'sales', value: saleID },
        { relationTo: 'after-sales', value: afterSalesID },
        ...(customerID === null ? [] : [{ relationTo: 'customers' as const, value: customerID }]),
      ],
      notes: `Tarefa automática criada ao ganhar ${opportunity.code || opportunity.id}. O histórico comercial permanece vinculado à oportunidade.`,
    } as never,
  })
}

export const automateWonOpportunity: CollectionAfterChangeHook = async ({ context, doc, operation, previousDoc, req }) => {
  if (context?.skipOpportunityWonAutomation) return doc
  const opportunity = doc as OpportunityDocument
  const becameWon = opportunity.stage === 'won' && (operation === 'create' || previousDoc?.stage !== 'won')
  if (!becameWon && !(opportunity.stage === 'won' && relationshipID(opportunity.wonSale) === null)) return doc

  const sale = await ensureSale(req, opportunity)
  if (relationshipID(opportunity.wonSale) === null) {
    await req.payload.update({
      collection: 'opportunities', id: opportunity.id, overrideAccess: true, req,
      context: { skipOpportunityWonAutomation: true },
      data: { wonSale: sale.id } as never,
    })
  }
  const afterSales = await ensureAfterSales(req, opportunity, sale.id)
  await ensureOnboardingTask(req, opportunity, sale.id, afterSales.id)
  return { ...doc, wonSale: sale.id }
}
