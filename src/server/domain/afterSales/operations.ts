import type { Payload } from 'payload'

import {
  isAfterSalesStatus,
  isOccurrenceSeverity,
  isOccurrenceStatus,
  isOccurrenceType,
  isShipmentStatus,
  isTaskStatus,
  isTaskType,
  operationalPriorities,
  type AfterSalesStatus,
  type OccurrenceSeverity,
  type OccurrenceStatus,
  type OccurrenceType,
  type OperationalPriority,
  type ShipmentStatus,
  type TaskStatus,
  type TaskType,
} from '../../../businessRules/afterSales/model'
import { relationshipID } from '../../../businessRules/relationships'

type WorkflowUser = { id?: string | number } | null | undefined

type CaseDocument = {
  id: string | number
  sale?: unknown
  customer?: unknown
  owner?: unknown
}

type SaleDocument = {
  id: string | number
  customer?: unknown
}

export type CreateCaseInput = {
  saleId: string | number
  summary?: string | null
}

export type CreateTaskInput = {
  caseId: string | number
  title: string
  type: TaskType
  dueAt: string
  priority: OperationalPriority
  assignee?: string | number | null
  notes?: string | null
}

export type CreateShipmentInput = {
  caseId: string | number
  carrier?: string | null
  trackingCode?: string | null
  status: ShipmentStatus
  estimatedDelivery?: string | null
  lastEvent?: string | null
  notes?: string | null
}

export type CreateOccurrenceInput = {
  caseId: string | number
  type: OccurrenceType
  severity: OccurrenceSeverity
  owner?: string | number | null
  description: string
}

function userOption(user: WorkflowUser) {
  return user as never
}

async function afterSalesCase(payload: Payload, user: WorkflowUser, id: string | number) {
  return await payload.findByID({
    collection: 'after-sales',
    id,
    depth: 0,
    overrideAccess: false,
    user: userOption(user),
  }) as unknown as CaseDocument
}

function relatedTo(caseDoc: CaseDocument) {
  const sale = relationshipID(caseDoc.sale)
  const customer = relationshipID(caseDoc.customer)
  return [
    { relationTo: 'after-sales' as const, value: caseDoc.id },
    sale !== null ? { relationTo: 'sales' as const, value: sale } : null,
    customer !== null ? { relationTo: 'customers' as const, value: customer } : null,
  ].filter(Boolean)
}

export async function createAfterSalesCase(payload: Payload, user: WorkflowUser, input: CreateCaseInput) {
  const sale = await payload.findByID({
    collection: 'sales',
    id: input.saleId,
    depth: 0,
    overrideAccess: false,
    user: userOption(user),
  }) as unknown as SaleDocument

  const customerId = relationshipID(sale.customer)
  if (customerId === null) throw new Error('A venda selecionada não tem um cliente vinculado.')

  const existing = await payload.find({
    collection: 'after-sales',
    where: { sale: { equals: input.saleId } },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user: userOption(user),
  })
  if (existing.docs.length) return { afterSales: existing.docs[0] }

  const afterSales = await payload.create({
    collection: 'after-sales',
    overrideAccess: false,
    user: userOption(user),
    data: {
      sale: input.saleId,
      customer: customerId,
      summary: input.summary?.trim() || null,
    } as never,
  })
  return { afterSales }
}

export async function createAfterSalesTask(payload: Payload, user: WorkflowUser, input: CreateTaskInput) {
  if (!input.title.trim()) throw new Error('Informe o objetivo do follow-up.')
  if (!isTaskType(input.type)) throw new Error('Informe um tipo de follow-up válido.')
  if (!input.dueAt || Number.isNaN(new Date(input.dueAt).getTime())) throw new Error('Informe um prazo válido.')
  if (!operationalPriorities.includes(input.priority)) throw new Error('Informe uma prioridade válida.')
  const caseDoc = await afterSalesCase(payload, user, input.caseId)

  const task = await payload.create({
    collection: 'tasks',
    overrideAccess: false,
    user: userOption(user),
    data: {
      title: input.title.trim(),
      type: input.type,
      status: 'pending',
      priority: input.priority,
      dueAt: new Date(input.dueAt).toISOString(),
      assignee: input.assignee || relationshipID(caseDoc.owner) || user?.id || undefined,
      relatedTo: relatedTo(caseDoc),
      notes: input.notes?.trim() || null,
    } as never,
  })
  return { task }
}

export async function updateAfterSalesTaskStatus(
  payload: Payload,
  user: WorkflowUser,
  id: string | number,
  status: TaskStatus,
) {
  if (!isTaskStatus(status)) throw new Error('Informe um status de tarefa válido.')
  const task = await payload.update({
    collection: 'tasks',
    id,
    overrideAccess: false,
    user: userOption(user),
    data: { status } as never,
  })
  return { task }
}

export async function createAfterSalesShipment(payload: Payload, user: WorkflowUser, input: CreateShipmentInput) {
  if (!isShipmentStatus(input.status)) throw new Error('Informe um status de entrega válido.')
  await afterSalesCase(payload, user, input.caseId)
  const shipment = await payload.create({
    collection: 'shipments',
    overrideAccess: false,
    user: userOption(user),
    data: {
      afterSalesCase: input.caseId,
      carrier: input.carrier?.trim() || null,
      trackingCode: input.trackingCode?.trim() || null,
      status: input.status,
      estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery).toISOString() : null,
      lastEvent: input.lastEvent?.trim() || null,
      notes: input.notes?.trim() || null,
    } as never,
  })
  return { shipment }
}

export async function updateAfterSalesShipment(
  payload: Payload,
  user: WorkflowUser,
  id: string | number,
  status: ShipmentStatus,
  lastEvent?: string | null,
) {
  if (!isShipmentStatus(status)) throw new Error('Informe um status de entrega válido.')
  const shipment = await payload.update({
    collection: 'shipments',
    id,
    overrideAccess: false,
    user: userOption(user),
    data: { status, lastEvent: lastEvent?.trim() || null } as never,
  })
  return { shipment }
}

export async function createAfterSalesOccurrence(payload: Payload, user: WorkflowUser, input: CreateOccurrenceInput) {
  if (!isOccurrenceType(input.type)) throw new Error('Informe um tipo de ocorrência válido.')
  if (!isOccurrenceSeverity(input.severity)) throw new Error('Informe uma severidade válida.')
  if (!input.description.trim()) throw new Error('Descreva a ocorrência.')
  const caseDoc = await afterSalesCase(payload, user, input.caseId)
  const occurrence = await payload.create({
    collection: 'occurrences',
    overrideAccess: false,
    user: userOption(user),
    data: {
      afterSalesCase: input.caseId,
      type: input.type,
      severity: input.severity,
      status: 'open',
      owner: input.owner || relationshipID(caseDoc.owner) || user?.id || undefined,
      description: input.description.trim(),
    } as never,
  })
  return { occurrence }
}

export async function resolveAfterSalesOccurrence(
  payload: Payload,
  user: WorkflowUser,
  id: string | number,
  status: OccurrenceStatus,
  resolution: string,
) {
  if (!isOccurrenceStatus(status) || !['resolved', 'closed'].includes(status)) throw new Error('Use resolvida ou encerrada para concluir a ocorrência.')
  if (!resolution.trim()) throw new Error('Registre a resolução da ocorrência.')
  const occurrence = await payload.update({
    collection: 'occurrences',
    id,
    overrideAccess: false,
    user: userOption(user),
    data: { status, resolution: resolution.trim() } as never,
  })
  return { occurrence }
}

export async function updateAfterSalesCase(
  payload: Payload,
  user: WorkflowUser,
  id: string | number,
  status: AfterSalesStatus,
  priority?: OperationalPriority,
) {
  if (!isAfterSalesStatus(status)) throw new Error('Informe um status de caso válido.')
  if (priority && !operationalPriorities.includes(priority)) throw new Error('Informe uma prioridade válida.')
  const afterSales = await payload.update({
    collection: 'after-sales',
    id,
    overrideAccess: false,
    user: userOption(user),
    data: { status, ...(priority ? { priority } : {}) } as never,
  })
  return { afterSales }
}
