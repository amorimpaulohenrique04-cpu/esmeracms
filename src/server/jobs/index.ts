import type {
  CollectionAfterChangeHook,
  PayloadRequest,
  TaskConfig,
} from 'payload'

import { isAdmin } from '../../access/roles'
import {
  isShipmentStatus,
  operationalPriorities,
  shipmentStatuses,
  taskTypes,
  type OperationalPriority,
  type TaskType,
} from '../../businessRules/afterSales/model'
import { relationshipID, type RelationshipValue } from '../../businessRules/relationships'

export const OPERATIONAL_JOBS_QUEUE = 'operational'
export const INTEGRATION_JOBS_QUEUE = 'integrations'
export const CREATE_AFTER_SALES_TASK_JOB = 'createAfterSalesTask'
export const SYNC_ACTIVE_SHIPMENTS_JOB = 'syncActiveShipments'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const activeShipmentStatuses = shipmentStatuses.filter((status) => !['delivered', 'cancelled'].includes(status))
const confirmedSaleStatuses = new Set(['confirmed', 'production', 'ready', 'delivered'])

type AutomationSettings = {
  preparationEnabled?: boolean | null
  preparationDelayHours?: number | null
  satisfactionEnabled?: boolean | null
  satisfactionDelayDays?: number | null
  testimonialEnabled?: boolean | null
  testimonialDelayDays?: number | null
  maintenanceEnabled?: boolean | null
  maintenanceDelayDays?: number | null
  maintenanceScope?: 'selected' | 'all' | null
  maintenanceProducts?: RelationshipValue[] | null
  maintenanceCategories?: RelationshipValue[] | null
}

type SaleItem = { product?: RelationshipValue }
type SaleDocument = {
  id: string | number
  number?: string | null
  customer?: RelationshipValue
  owner?: RelationshipValue
  status?: string | null
  expectedDeliveryAt?: string | null
  deliveredAt?: string | null
  items?: SaleItem[] | null
}

type ShipmentDocument = {
  id: string | number
  sale?: RelationshipValue
  trackingCode?: string | null
  carrier?: string | null
  status?: string | null
  estimatedDelivery?: string | null
  deliveredAt?: string | null
  lastEvent?: string | null
}

type TrackingResponse = {
  status?: unknown
  lastEvent?: unknown
  estimatedDelivery?: unknown
  deliveredAt?: unknown
}

function nonNegativeInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

function validISO(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

function storedRelationshipID(value: unknown): string | number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized) return undefined
  return /^\d+$/.test(normalized) ? Number(normalized) : normalized
}

function relationIDs(values: RelationshipValue[] | null | undefined) {
  return new Set((values || []).map(relationshipID).filter((value): value is string | number => value !== null).map(String))
}

async function automationSettings(req: PayloadRequest) {
  return await req.payload.findGlobal({
    slug: 'after-sales-automation',
    depth: 0,
    overrideAccess: true,
    req,
  }) as unknown as AutomationSettings
}

async function loadSale(req: PayloadRequest, id: string | number) {
  return await req.payload.findByID({
    collection: 'sales',
    id,
    depth: 0,
    overrideAccess: true,
    req,
    select: {
      number: true,
      customer: true,
      owner: true,
      status: true,
      expectedDeliveryAt: true,
      deliveredAt: true,
      items: true,
    },
  }) as unknown as SaleDocument
}

async function maintenanceApplies(req: PayloadRequest, sale: SaleDocument, settings: AutomationSettings) {
  if (!settings.maintenanceEnabled) return false
  if (settings.maintenanceScope === 'all') return true

  const selectedProducts = relationIDs(settings.maintenanceProducts)
  const selectedCategories = relationIDs(settings.maintenanceCategories)
  const productIDs = (sale.items || [])
    .map((item) => relationshipID(item.product))
    .filter((value): value is string | number => value !== null)

  if (productIDs.some((id) => selectedProducts.has(String(id)))) return true
  if (!selectedCategories.size) return false

  for (const productID of productIDs) {
    const product = await req.payload.findByID({
      collection: 'products',
      id: productID,
      depth: 0,
      overrideAccess: true,
      req,
      select: { categories: true },
    }) as unknown as { categories?: RelationshipValue[] | null }
    const productCategories = relationIDs(product.categories)
    if ([...productCategories].some((id) => selectedCategories.has(id))) return true
  }

  return false
}

async function queueAutomatedTask(req: PayloadRequest, input: {
  automationKey: string
  saleId: string | number
  title: string
  type: TaskType
  dueAt: string
  priority?: OperationalPriority
  assigneeId?: string | number | null
  notes?: string | null
  waitUntil?: string | null
}) {
  await req.payload.jobs.queue({
    task: CREATE_AFTER_SALES_TASK_JOB,
    queue: OPERATIONAL_JOBS_QUEUE,
    waitUntil: input.waitUntil ? new Date(input.waitUntil) : undefined,
    input: {
      automationKey: input.automationKey,
      saleId: String(input.saleId),
      title: input.title,
      type: input.type,
      dueAt: input.dueAt,
      priority: input.priority || 'normal',
      assigneeId: input.assigneeId === null || input.assigneeId === undefined ? undefined : String(input.assigneeId),
      notes: input.notes || undefined,
    },
  } as never)
}

export async function scheduleSalePreparation(req: PayloadRequest, sale: SaleDocument) {
  const settings = await automationSettings(req)
  if (settings.preparationEnabled === false) return

  const now = Date.now()
  const delayHours = nonNegativeInteger(settings.preparationDelayHours, 0)
  const dueAt = validISO(sale.expectedDeliveryAt)
    ? sale.expectedDeliveryAt
    : new Date(now + delayHours * HOUR_MS).toISOString()
  const number = sale.number || sale.id

  await queueAutomatedTask(req, {
    automationKey: `sale:${sale.id}:preparation:v1`,
    saleId: sale.id,
    title: `Preparar entrega da venda ${number}`,
    type: 'delivery_confirmation',
    dueAt,
    priority: 'normal',
    assigneeId: relationshipID(sale.owner),
    notes: 'Tarefa criada automaticamente ao confirmar a venda.',
  })
}

export async function scheduleDeliveredSaleFollowUps(
  req: PayloadRequest,
  sale: SaleDocument,
  deliveredAt: string,
) {
  if (!validISO(deliveredAt)) return
  const settings = await automationSettings(req)
  const base = new Date(deliveredAt).getTime()
  const number = sale.number || sale.id
  const assigneeId = relationshipID(sale.owner)

  if (settings.satisfactionEnabled !== false) {
    const days = nonNegativeInteger(settings.satisfactionDelayDays, 3)
    const dueAt = new Date(base + days * DAY_MS).toISOString()
    await queueAutomatedTask(req, {
      automationKey: `sale:${sale.id}:satisfaction:v1`,
      saleId: sale.id,
      title: `Medir satisfação da venda ${number}`,
      type: 'satisfaction',
      dueAt,
      waitUntil: dueAt,
      priority: 'normal',
      assigneeId,
      notes: `Follow-up automático D+${days} após a entrega registrada.`,
    })
  }

  if (settings.testimonialEnabled !== false) {
    const days = nonNegativeInteger(settings.testimonialDelayDays, 15)
    const dueAt = new Date(base + days * DAY_MS).toISOString()
    await queueAutomatedTask(req, {
      automationKey: `sale:${sale.id}:testimonial:v1`,
      saleId: sale.id,
      title: `Solicitar foto ou depoimento da venda ${number}`,
      type: 'testimonial',
      dueAt,
      waitUntil: dueAt,
      priority: 'normal',
      assigneeId,
      notes: `Follow-up automático D+${days} após a entrega registrada.`,
    })
  }

  if (await maintenanceApplies(req, sale, settings)) {
    const days = nonNegativeInteger(settings.maintenanceDelayDays, 90)
    const dueAt = new Date(base + days * DAY_MS).toISOString()
    await queueAutomatedTask(req, {
      automationKey: `sale:${sale.id}:maintenance:v1`,
      saleId: sale.id,
      title: `Manutenção preventiva da venda ${number}`,
      type: 'maintenance',
      dueAt,
      waitUntil: dueAt,
      priority: 'normal',
      assigneeId,
      notes: `Follow-up automático D+${days} conforme regra de produto ou categoria.`,
    })
  }
}

async function ensureAfterSalesCase(req: PayloadRequest, sale: SaleDocument) {
  const existing = await req.payload.find({
    collection: 'after-sales',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where: { sale: { equals: sale.id } },
  })
  if (existing.docs[0]) return existing.docs[0]

  const customer = relationshipID(sale.customer)
  if (customer === null) throw new Error(`A venda ${sale.id} não possui cliente para abrir o pós-venda.`)

  return await req.payload.create({
    collection: 'after-sales',
    overrideAccess: true,
    req,
    context: { skipJobScheduling: true },
    data: {
      sale: sale.id,
      customer,
      owner: relationshipID(sale.owner) || undefined,
      status: 'open',
      priority: 'normal',
      summary: `Caso criado automaticamente pela Jobs Queue para a venda ${sale.number || sale.id}.`,
    } as never,
  })
}

async function findTaskByAutomationKey(req: PayloadRequest, automationKey: string) {
  const result = await req.payload.find({
    collection: 'tasks',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where: { automationKey: { equals: automationKey } } as never,
  })
  return result.docs[0]
}

export const CreateAfterSalesTaskJob = {
  slug: CREATE_AFTER_SALES_TASK_JOB,
  label: 'Criar tarefa automática de pós-venda',
  retries: 3,
  inputSchema: [
    { name: 'automationKey', type: 'text', required: true },
    { name: 'saleId', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: taskTypes.map((value) => ({ label: value, value })),
    },
    { name: 'dueAt', type: 'date', required: true },
    {
      name: 'priority',
      type: 'select',
      required: true,
      options: operationalPriorities.map((value) => ({ label: value, value })),
    },
    { name: 'assigneeId', type: 'text' },
    { name: 'notes', type: 'textarea' },
  ],
  outputSchema: [
    { name: 'taskID', type: 'text' },
    { name: 'created', type: 'checkbox', required: true },
    { name: 'reason', type: 'text' },
  ],
  handler: async ({ input, req }) => {
    const existing = await findTaskByAutomationKey(req, input.automationKey)
    if (existing) {
      return { output: { taskID: String(existing.id), created: false, reason: 'already-created' } }
    }

    const saleID = storedRelationshipID(input.saleId) || input.saleId
    const sale = await loadSale(req, saleID)
    if (sale.status === 'cancelled') {
      return { output: { created: false, reason: 'sale-cancelled' } }
    }

    const afterSalesCase = await ensureAfterSalesCase(req, sale)
    const customer = relationshipID(sale.customer)
    const assignee = storedRelationshipID(input.assigneeId) || relationshipID(sale.owner) || undefined
    const relatedTo = [
      { relationTo: 'after-sales' as const, value: afterSalesCase.id },
      { relationTo: 'sales' as const, value: sale.id },
      customer !== null ? { relationTo: 'customers' as const, value: customer } : null,
    ].filter(Boolean)

    try {
      const task = await req.payload.create({
        collection: 'tasks',
        overrideAccess: true,
        req,
        context: { skipJobScheduling: true },
        data: {
          automationKey: input.automationKey,
          title: input.title,
          type: input.type,
          status: 'pending',
          priority: input.priority,
          dueAt: input.dueAt,
          assignee,
          relatedTo,
          notes: input.notes || null,
        } as never,
      })
      return { output: { taskID: String(task.id), created: true } }
    } catch (error) {
      const concurrent = await findTaskByAutomationKey(req, input.automationKey)
      if (concurrent) {
        return { output: { taskID: String(concurrent.id), created: false, reason: 'concurrent-duplicate' } }
      }
      throw error
    }
  },
} as TaskConfig<typeof CREATE_AFTER_SALES_TASK_JOB>

function trackingHeaders() {
  const token = process.env.TRACKING_SYNC_TOKEN
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function syncShipment(req: PayloadRequest, shipment: ShipmentDocument) {
  const endpoint = process.env.TRACKING_SYNC_URL
  if (!endpoint || !shipment.trackingCode) return false

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: trackingHeaders(),
    body: JSON.stringify({
      shipmentId: shipment.id,
      trackingCode: shipment.trackingCode,
      carrier: shipment.carrier || null,
      currentStatus: shipment.status || null,
    }),
  })
  if (!response.ok) throw new Error(`Tracking sync failed with HTTP ${response.status}.`)

  const result = await response.json() as TrackingResponse
  const nextStatus = isShipmentStatus(result.status) ? result.status : shipment.status
  const nextEstimatedDelivery = validISO(result.estimatedDelivery) ? result.estimatedDelivery : shipment.estimatedDelivery
  const nextDeliveredAt = validISO(result.deliveredAt) ? result.deliveredAt : shipment.deliveredAt
  const nextEvent = typeof result.lastEvent === 'string' && result.lastEvent.trim()
    ? result.lastEvent.trim()
    : shipment.lastEvent

  if (!nextStatus || !isShipmentStatus(nextStatus)) return false
  const changed = nextStatus !== shipment.status || nextEstimatedDelivery !== shipment.estimatedDelivery ||
    nextDeliveredAt !== shipment.deliveredAt || nextEvent !== shipment.lastEvent
  if (!changed) return false

  await req.payload.update({
    collection: 'shipments',
    id: shipment.id,
    overrideAccess: true,
    req,
    data: {
      status: nextStatus,
      estimatedDelivery: nextEstimatedDelivery || null,
      deliveredAt: nextDeliveredAt || null,
      lastEvent: nextEvent || null,
    } as never,
  })
  return true
}

export const SyncActiveShipmentsJob = {
  slug: SYNC_ACTIVE_SHIPMENTS_JOB,
  label: 'Sincronizar entregas ativas',
  retries: 2,
  schedule: process.env.TRACKING_SYNC_URL
    ? [{ cron: '*/15 * * * *', queue: INTEGRATION_JOBS_QUEUE }]
    : undefined,
  inputSchema: [],
  outputSchema: [
    { name: 'configured', type: 'checkbox', required: true },
    { name: 'scanned', type: 'number', required: true },
    { name: 'updated', type: 'number', required: true },
  ],
  handler: async ({ req }) => {
    if (!process.env.TRACKING_SYNC_URL) {
      return { output: { configured: false, scanned: 0, updated: 0 } }
    }

    const shipments = await req.payload.find({
      collection: 'shipments',
      depth: 0,
      limit: 100,
      pagination: false,
      overrideAccess: true,
      req,
      where: { status: { in: activeShipmentStatuses } },
    })
    const trackable = shipments.docs.filter((item) => Boolean((item as ShipmentDocument).trackingCode)) as unknown as ShipmentDocument[]
    let updated = 0
    for (const shipment of trackable) {
      if (await syncShipment(req, shipment)) updated += 1
    }

    return { output: { configured: true, scanned: trackable.length, updated } }
  },
} as TaskConfig<typeof SYNC_ACTIVE_SHIPMENTS_JOB>

export const esmeraJobTasks = [CreateAfterSalesTaskJob, SyncActiveShipmentsJob]

export function canRunEsmeraJobs({ req }: { req: PayloadRequest }) {
  if (isAdmin(req.user)) return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export const scheduleSaleJobs: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (req.context?.skipJobScheduling) return doc
  const sale = doc as unknown as SaleDocument
  const previous = (previousDoc || {}) as SaleDocument
  const eligible = confirmedSaleStatuses.has(String(sale.status || ''))
  const wasEligible = confirmedSaleStatuses.has(String(previous.status || ''))

  if (eligible && (operation === 'create' || !wasEligible)) {
    await scheduleSalePreparation(req, sale)
  }

  if (validISO(sale.deliveredAt) && sale.deliveredAt !== previous.deliveredAt) {
    await scheduleDeliveredSaleFollowUps(req, sale, sale.deliveredAt)
  }

  return doc
}

export const scheduleShipmentJobs: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (req.context?.skipJobScheduling) return doc
  const shipment = doc as unknown as ShipmentDocument
  const previous = (previousDoc || {}) as ShipmentDocument
  const becameDelivered = shipment.status === 'delivered' &&
    (operation === 'create' || previous.status !== 'delivered' || shipment.deliveredAt !== previous.deliveredAt)
  if (!becameDelivered || !validISO(shipment.deliveredAt)) return doc

  const saleID = relationshipID(shipment.sale)
  if (saleID === null) return doc
  const sale = await loadSale(req, saleID)
  await scheduleDeliveredSaleFollowUps(req, sale, shipment.deliveredAt)
  return doc
}
