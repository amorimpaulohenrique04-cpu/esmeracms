import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import {
  createAfterSalesCase,
  createAfterSalesOccurrence,
  createAfterSalesShipment,
  createAfterSalesTask,
  resolveAfterSalesOccurrence,
  updateAfterSalesShipment,
  updateAfterSalesTaskStatus,
} from '@/server/domain/afterSales/operations'
import { winOpportunity } from '@/server/domain/sales/opportunityWorkflow'
import type {
  AfterSale,
  Customer,
  Occurrence,
  Opportunity,
  Product,
  Sale,
  Shipment,
  Task,
  User,
} from '@/payload-types'

let payload: Payload
let commercialUser: User
const stamp = Date.now().toString(36)
const created = {
  users: [] as User['id'][],
  customers: [] as Customer['id'][],
  products: [] as Product['id'][],
  opportunities: [] as Opportunity['id'][],
  sales: [] as Sale['id'][],
  afterSales: [] as AfterSale['id'][],
  tasks: [] as Task['id'][],
  shipments: [] as Shipment['id'][],
  occurrences: [] as Occurrence['id'][],
}

async function remove(collection: keyof typeof created, ids: Array<string | number>) {
  const slug = collection === 'afterSales' ? 'after-sales' : collection
  for (const id of [...ids].reverse()) {
    try {
      await payload.delete({ collection: slug, id, overrideAccess: true } as never)
    } catch {
      // Relations or prior rollback may already have removed the document.
    }
  }
}

describe('Stage 10 after-sales operational workflow', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    commercialUser = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `after-sales-${stamp}@esmera.test`,
        password: 'test-password-123',
        name: `After Sales ${stamp}`,
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
      where: {
        or: [
          { summary: { contains: stamp } },
          { details: { contains: stamp } },
        ],
      },
    })
    await remove('occurrences', created.occurrences)
    await remove('shipments', created.shipments)
    await remove('tasks', created.tasks)
    await remove('afterSales', created.afterSales)
    await remove('sales', created.sales)
    await remove('opportunities', created.opportunities)
    await remove('products', created.products)
    await remove('customers', created.customers)
    await remove('users', created.users)
  }, 60_000)

  it('operates a case through task, discrete delivery and occurrence resolution', async () => {
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente Pós-venda ${stamp}`, email: `pos-${stamp}@example.com` },
    })
    created.customers.push(customer.id)

    const product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Objeto Pós-venda ${stamp}`,
        code: `POS-${stamp}`.toUpperCase(),
        slug: `objeto-pos-${stamp}`,
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 185_000,
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
        stage: 'negotiation',
        owner: commercialUser.id,
        interestedProducts: [product.id],
        estimatedValueCents: 185_000,
        nextAction: `Confirmar pós-venda ${stamp}`,
      },
    })
    created.opportunities.push(opportunity.id)

    const won = await winOpportunity(payload, commercialUser, {
      id: opportunity.id,
      channel: 'whatsapp',
      items: [{ product: product.id, quantity: 1 }],
      expectedDeliveryAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      deliveryMode: 'carrier',
      deliveryNotes: `Entrega Stage 10 ${stamp}`,
    })
    created.sales.push(won.sale.id)

    const afterSales = await payload.create({
      collection: 'after-sales',
      overrideAccess: true,
      user: commercialUser,
      data: {
        sale: won.sale.id,
        customer: customer.id,
        status: 'open',
        priority: 'high',
        owner: commercialUser.id,
        summary: `Acompanhamento operacional ${stamp}`,
      } as never,
    })
    created.afterSales.push(afterSales.id)
    expect(afterSales.caseNumber).toMatch(/^POS-/)
    expect(afterSales.openedAt).toBeTruthy()

    const taskResult = await createAfterSalesTask(payload, commercialUser, {
      caseId: afterSales.id,
      title: `Confirmar recebimento ${stamp}`,
      type: 'delivery_confirmation',
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      priority: 'high',
      notes: `Contato verificável ${stamp}`,
    })
    created.tasks.push(taskResult.task.id)
    expect(taskResult.task.type).toBe('delivery_confirmation')
    expect(taskResult.task.status).toBe('pending')
    expect(taskResult.task.relatedTo?.some((item) => item.relationTo === 'after-sales')).toBe(true)

    const completed = await updateAfterSalesTaskStatus(payload, commercialUser, taskResult.task.id, 'done')
    expect(completed.task.status).toBe('done')
    expect(completed.task.completedAt).toBeTruthy()

    const shipmentResult = await createAfterSalesShipment(payload, commercialUser, {
      caseId: afterSales.id,
      carrier: `Transportadora ${stamp}`,
      trackingCode: `TRACK-${stamp}`.toUpperCase(),
      status: 'confirmed',
      estimatedDelivery: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      lastEvent: `Pedido confirmado ${stamp}`,
    })
    created.shipments.push(shipmentResult.shipment.id)
    expect(String(typeof shipmentResult.shipment.sale === 'object' ? shipmentResult.shipment.sale?.id : shipmentResult.shipment.sale)).toBe(String(won.sale.id))
    expect(String(typeof shipmentResult.shipment.customer === 'object' ? shipmentResult.shipment.customer?.id : shipmentResult.shipment.customer)).toBe(String(customer.id))

    const delivered = await updateAfterSalesShipment(
      payload,
      commercialUser,
      shipmentResult.shipment.id,
      'delivered',
      `Entrega confirmada ${stamp}`,
    )
    expect(delivered.shipment.status).toBe('delivered')
    expect(delivered.shipment.deliveredAt).toBeTruthy()

    const occurrenceResult = await createAfterSalesOccurrence(payload, commercialUser, {
      caseId: afterSales.id,
      type: 'damage',
      severity: 'high',
      description: `Avaria documentada ${stamp}`,
    })
    created.occurrences.push(occurrenceResult.occurrence.id)
    expect(occurrenceResult.occurrence.status).toBe('open')
    expect(occurrenceResult.occurrence.openedAt).toBeTruthy()

    await expect(resolveAfterSalesOccurrence(
      payload,
      commercialUser,
      occurrenceResult.occurrence.id,
      'resolved',
      '',
    )).rejects.toThrow(/resolução/i)

    const resolved = await resolveAfterSalesOccurrence(
      payload,
      commercialUser,
      occurrenceResult.occurrence.id,
      'resolved',
      `Substituição concluída ${stamp}`,
    )
    expect(resolved.occurrence.status).toBe('resolved')
    expect(resolved.occurrence.closedAt).toBeTruthy()
    expect(resolved.occurrence.resolution).toContain(stamp)

    const activities = await payload.find({
      collection: 'activities',
      overrideAccess: true,
      depth: 0,
      limit: 100,
      where: {
        or: [
          { summary: { contains: stamp } },
          { details: { contains: stamp } },
        ],
      },
    })
    expect(activities.docs.some((activity) => activity.eventType === 'followup.completed')).toBe(true)
    expect(activities.docs.some((activity) => activity.eventType === 'shipment.delivered')).toBe(true)
    expect(activities.docs.some((activity) => activity.eventType === 'occurrence.resolved')).toBe(true)
  }, 60_000)

  it('registers a manual after-sales case for a sale without requiring the customer field from the client', async () => {
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente Registro ${stamp}`, email: `registro-${stamp}@example.com` },
    })
    created.customers.push(customer.id)

    const product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Objeto Registro ${stamp}`,
        code: `REG-${stamp}`.toUpperCase(),
        slug: `objeto-registro-${stamp}`,
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 92_000,
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
        stage: 'negotiation',
        owner: commercialUser.id,
        interestedProducts: [product.id],
        estimatedValueCents: 92_000,
        nextAction: `Confirmar registro ${stamp}`,
      },
    })
    created.opportunities.push(opportunity.id)

    const won = await winOpportunity(payload, commercialUser, {
      id: opportunity.id,
      channel: 'whatsapp',
      items: [{ product: product.id, quantity: 1 }],
      expectedDeliveryAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      deliveryMode: 'carrier',
      deliveryNotes: `Entrega registro ${stamp}`,
    })
    created.sales.push(won.sale.id)

    // Only saleId is supplied here — the client never sends a customer, mirroring
    // the "Registrar acompanhamento" popup. The customer must be derived server-side.
    const first = await createAfterSalesCase(payload, commercialUser, {
      saleId: won.sale.id,
      summary: `Cliente ligou perguntando pela entrega ${stamp}`,
    })
    created.afterSales.push(first.afterSales.id)
    expect(first.afterSales.caseNumber).toMatch(/^POS-/)
    const derivedCustomer = typeof first.afterSales.customer === 'object' ? first.afterSales.customer?.id : first.afterSales.customer
    expect(String(derivedCustomer)).toBe(String(customer.id))

    const second = await createAfterSalesCase(payload, commercialUser, { saleId: won.sale.id })
    expect(String(second.afterSales.id)).toBe(String(first.afterSales.id))

    const cases = await payload.count({
      collection: 'after-sales',
      overrideAccess: true,
      where: { sale: { equals: won.sale.id } },
    })
    expect(cases.totalDocs).toBe(1)
  }, 60_000)
})
