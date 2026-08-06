import { randomUUID } from 'node:crypto'

import type { Payload, PayloadRequest } from 'payload'

import {
  canTransitionOpportunity,
  isOpportunityLossReason,
  isOpportunityStage,
  openOpportunityStages,
  type OpportunityLossReason,
  type OpportunityStage,
} from '../../../businessRules/opportunities/stages'
import { relationshipID } from '../../../businessRules/relationships'
import { syncClientInterests } from '../../../hooks/clientInterests/syncClientInterests'

type WorkflowUser = { id?: string | number } | null | undefined

type OpportunityDocument = {
  id: string | number
  code?: string | null
  stage?: string | null
  rank?: number | null
  customer?: unknown
  owner?: unknown
  wonSale?: unknown
}

export type SaleWorkflowItem = {
  product: string | number
  variantSku?: string | null
  unitPriceCents?: number | null
  quantity: number
}

export type CreateSaleInput = {
  customerID: string | number
  items: SaleWorkflowItem[]
}

export type MoveOpportunityInput = {
  id: string | number
  toStage: OpportunityStage
  targetOrderedIds: Array<string | number>
  sourceStage?: OpportunityStage | null
  sourceOrderedIds?: Array<string | number>
}

export type WinOpportunityInput = {
  id: string | number
  channel: 'whatsapp' | 'instagram' | 'site' | 'referral' | 'architect' | 'other'
  items: SaleWorkflowItem[]
  discountCents?: number
  shippingCents?: number
  expectedDeliveryAt?: string | null
  deliveryMode?: 'carrier' | 'pickup' | 'own_delivery' | null
  deliveryNotes?: string | null
}

export type LoseOpportunityInput = {
  id: string | number
  lossReason: OpportunityLossReason
  lossNotes?: string | null
}

const openStageSet = new Set<OpportunityStage>(openOpportunityStages)

function stageRank(stage: OpportunityStage, index: number) {
  const stageIndex = openOpportunityStages.indexOf(stage as typeof openOpportunityStages[number])
  return Math.max(0, stageIndex) * 1_000_000_000 + (index + 1) * 10_000
}

function saleNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `ESM-${date}-${randomUUID().slice(0, 6).toUpperCase()}`
}

function workflowRequest(payload: Payload, user: WorkflowUser, transactionID: number | string) {
  return {
    payload,
    user: user || undefined,
    transactionID,
    context: {},
  } as unknown as PayloadRequest
}

async function withTransaction<T>(payload: Payload, user: WorkflowUser, operation: (req: PayloadRequest) => Promise<T>) {
  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null || transactionID === undefined) throw new Error('O banco não iniciou a transação comercial.')
  const req = workflowRequest(payload, user, transactionID)
  try {
    const result = await operation(req)
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

async function opportunityByID(payload: Payload, user: WorkflowUser, id: string | number, req?: PayloadRequest) {
  return await payload.findByID({
    collection: 'opportunities',
    id,
    depth: 0,
    overrideAccess: false,
    user: user as never,
    req,
  }) as unknown as OpportunityDocument
}

function assertTransition(opportunity: OpportunityDocument, toStage: OpportunityStage) {
  if (!isOpportunityStage(opportunity.stage)) throw new Error('A oportunidade não possui uma etapa comercial válida.')
  if (!canTransitionOpportunity(opportunity.stage, toStage)) {
    throw new Error(`A transição de ${opportunity.stage} para ${toStage} não é permitida.`)
  }
  if (opportunity.wonSale && toStage !== 'won') throw new Error('A oportunidade já possui uma venda relacionada.')
}

async function persistOrder(
  payload: Payload,
  user: WorkflowUser,
  req: PayloadRequest,
  stage: OpportunityStage,
  orderedIds: Array<string | number>,
) {
  const unique = Array.from(new Map(orderedIds.map((id) => [String(id), id])).values())
  for (const [index, id] of unique.entries()) {
    await payload.update({
      collection: 'opportunities',
      id,
      overrideAccess: false,
      user: user as never,
      req,
      data: { stage, rank: stageRank(stage, index) } as never,
    })
  }
}

export async function moveOpportunity(payload: Payload, user: WorkflowUser, input: MoveOpportunityInput) {
  if (!openStageSet.has(input.toStage)) throw new Error('Ganho e perda exigem confirmação pelos diálogos de fechamento.')
  return await withTransaction(payload, user, async (req) => {
    const opportunity = await opportunityByID(payload, user, input.id, req)
    assertTransition(opportunity, input.toStage)
    const fromStage = isOpportunityStage(opportunity.stage) ? opportunity.stage : null

    if (input.sourceStage && input.sourceStage !== input.toStage && input.sourceOrderedIds) {
      await persistOrder(payload, user, req, input.sourceStage, input.sourceOrderedIds)
    }
    const target = input.targetOrderedIds.some((id) => String(id) === String(input.id))
      ? input.targetOrderedIds
      : [...input.targetOrderedIds, input.id]
    await persistOrder(payload, user, req, input.toStage, target)

    return {
      opportunity: await opportunityByID(payload, user, input.id, req),
      fromStage,
      toStage: input.toStage,
    }
  })
}

export async function reorderOpportunityStage(
  payload: Payload,
  user: WorkflowUser,
  stage: OpportunityStage,
  orderedIds: Array<string | number>,
) {
  if (!openStageSet.has(stage)) throw new Error('Somente etapas abertas podem ser reordenadas.')
  return await withTransaction(payload, user, async (req) => {
    await persistOrder(payload, user, req, stage, orderedIds)
    return { updated: orderedIds.length }
  })
}

export async function bulkMoveOpportunities(
  payload: Payload,
  user: WorkflowUser,
  ids: Array<string | number>,
  toStage: OpportunityStage,
) {
  if (!openStageSet.has(toStage)) throw new Error('Fechamentos em lote não são permitidos.')
  const unique = Array.from(new Map(ids.map((id) => [String(id), id])).values())
  return await withTransaction(payload, user, async (req) => {
    const existing = await Promise.all(unique.map((id) => opportunityByID(payload, user, id, req)))
    existing.forEach((opportunity) => assertTransition(opportunity, toStage))
    for (const [index, opportunity] of existing.entries()) {
      await payload.update({
        collection: 'opportunities',
        id: opportunity.id,
        overrideAccess: false,
        user: user as never,
        req,
        data: { stage: toStage, rank: stageRank(toStage, index) } as never,
      })
    }
    return { updated: existing.length }
  })
}

export async function loseOpportunity(payload: Payload, user: WorkflowUser, input: LoseOpportunityInput) {
  if (!isOpportunityLossReason(input.lossReason)) throw new Error('Informe um motivo de perda válido.')
  return await withTransaction(payload, user, async (req) => {
    const opportunity = await opportunityByID(payload, user, input.id, req)
    assertTransition(opportunity, 'lost')
    const updated = await payload.update({
      collection: 'opportunities',
      id: input.id,
      overrideAccess: false,
      user: user as never,
      req,
      data: {
        stage: 'lost',
        lossReason: input.lossReason,
        lossNotes: input.lossNotes?.trim() || null,
      } as never,
    })
    return { opportunity: updated }
  })
}

export async function createSale(payload: Payload, user: WorkflowUser, input: CreateSaleInput) {
  if (input.customerID === undefined || input.customerID === null || String(input.customerID).trim() === '') {
    throw new Error('Selecione o cliente da venda.')
  }
  if (!input.items.length) throw new Error('Confirme ao menos um item para criar a venda.')
  if (input.items.some((item) => !item.product || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw new Error('Todos os itens precisam de produto e quantidade inteira maior que zero.')
  }

  return await withTransaction(payload, user, async (req) => {
    const sale = await payload.create({
      collection: 'sales',
      overrideAccess: false,
      user: user as never,
      req,
      data: {
        number: saleNumber(),
        customer: input.customerID,
        channel: 'whatsapp',
        status: 'confirmed',
        owner: user?.id,
        items: input.items.map((item) => ({
          product: item.product,
          variantSku: item.variantSku?.trim() || null,
          unitPriceCents: typeof item.unitPriceCents === 'number' ? item.unitPriceCents : null,
          quantity: item.quantity,
        })),
        discountCents: 0,
        shippingCents: 0,
      } as never,
    })

    await payload.create({
      collection: 'activities',
      overrideAccess: false,
      user: user as never,
      req,
      data: {
        eventType: 'sale.created',
        kind: 'sale',
        occurredAt: new Date().toISOString(),
        summary: `Venda ${sale.number} criada manualmente`,
        details: typeof sale.totalCents === 'number'
          ? `Total confirmado: ${(sale.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
          : undefined,
        owner: user?.id,
        relatedTo: [
          { relationTo: 'sales', value: sale.id },
          { relationTo: 'customers', value: input.customerID },
        ],
      } as never,
    })

    return { sale }
  })
}

export async function winOpportunity(payload: Payload, user: WorkflowUser, input: WinOpportunityInput) {
  if (!input.items.length) throw new Error('Confirme ao menos um item para criar a venda.')
  if (input.items.some((item) => !item.product || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw new Error('Todos os itens precisam de produto e quantidade inteira maior que zero.')
  }

  return await withTransaction(payload, user, async (req) => {
    const opportunity = await opportunityByID(payload, user, input.id, req)
    assertTransition(opportunity, 'won')
    const customerID = relationshipID(opportunity.customer)
    if (customerID === null) throw new Error('Vincule um Customer antes de marcar a oportunidade como ganha.')
    if (relationshipID(opportunity.wonSale) !== null) throw new Error('Esta oportunidade já gerou uma venda.')

    const sale = await payload.create({
      collection: 'sales',
      overrideAccess: false,
      user: user as never,
      req,
      data: {
        number: saleNumber(),
        customer: customerID,
        opportunity: opportunity.id,
        channel: input.channel,
        status: 'confirmed',
        owner: relationshipID(opportunity.owner),
        items: input.items.map((item) => ({
          product: item.product,
          variantSku: item.variantSku?.trim() || null,
          unitPriceCents: typeof item.unitPriceCents === 'number' ? item.unitPriceCents : null,
          quantity: item.quantity,
        })),
        discountCents: input.discountCents || 0,
        shippingCents: input.shippingCents || 0,
        expectedDeliveryAt: input.expectedDeliveryAt || null,
        deliveryMode: input.deliveryMode || null,
        deliveryNotes: input.deliveryNotes?.trim() || null,
      } as never,
    })

    const updated = await payload.update({
      collection: 'opportunities',
      id: opportunity.id,
      overrideAccess: false,
      user: user as never,
      req,
      data: { stage: 'won', wonSale: sale.id } as never,
    })

    await syncClientInterests(payload, user, {
      customerId: customerID,
      productIds: input.items.map((item) => item.product),
      source: 'sale',
      status: 'purchased',
    }, req)

    await payload.create({
      collection: 'activities',
      overrideAccess: false,
      user: user as never,
      req,
      data: {
        eventType: 'sale.created',
        kind: 'sale',
        occurredAt: new Date().toISOString(),
        summary: `Venda ${sale.number} criada a partir de ${opportunity.code || opportunity.id}`,
        details: typeof sale.totalCents === 'number' ? `Total confirmado: ${(sale.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` : undefined,
        owner: relationshipID(opportunity.owner) ?? user?.id ?? undefined,
        opportunity: opportunity.id,
        relatedTo: [
          { relationTo: 'opportunities', value: opportunity.id },
          { relationTo: 'sales', value: sale.id },
          { relationTo: 'customers', value: customerID },
        ],
      } as never,
    })

    return { opportunity: updated, sale }
  })
}
