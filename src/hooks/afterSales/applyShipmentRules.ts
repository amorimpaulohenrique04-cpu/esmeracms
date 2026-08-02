import type { CollectionAfterChangeHook, CollectionBeforeValidateHook } from 'payload'

import { relationshipID, type RelationshipValue } from '../../businessRules/relationships'

type ShipmentData = {
  afterSalesCase?: RelationshipValue
  sale?: RelationshipValue
  customer?: RelationshipValue
  status?: string | null
  deliveredAt?: string | null
  lastEvent?: string | null
}

export const applyShipmentRules: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const incoming = data as ShipmentData
  const original = (originalDoc || {}) as ShipmentData
  const caseID = relationshipID(incoming.afterSalesCase ?? original.afterSalesCase)

  if (caseID !== null) {
    const afterSalesCase = await req.payload.findByID({
      collection: 'after-sales',
      id: caseID,
      depth: 0,
      overrideAccess: true,
      req,
      select: { sale: true, customer: true },
    })
    incoming.sale = relationshipID(afterSalesCase.sale)
    incoming.customer = relationshipID(afterSalesCase.customer)
  }

  const status = incoming.status ?? original.status
  if (status === 'delivered') incoming.deliveredAt = incoming.deliveredAt || original.deliveredAt || new Date().toISOString()
  else if (incoming.deliveredAt === undefined) incoming.deliveredAt = original.deliveredAt || null

  return data
}

export const recordShipmentActivity: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (req.context?.skipAfterSalesActivity) return doc
  const previousStatus = previousDoc?.status as string | undefined
  const status = doc.status as string | undefined
  if (operation === 'update' && previousStatus === status) return doc

  const caseID = relationshipID(doc.afterSalesCase)
  const saleID = relationshipID(doc.sale)
  const customerID = relationshipID(doc.customer)
  const relatedTo = [
    caseID !== null ? { relationTo: 'after-sales' as const, value: caseID } : null,
    { relationTo: 'shipments' as const, value: doc.id },
    saleID !== null ? { relationTo: 'sales' as const, value: saleID } : null,
    customerID !== null ? { relationTo: 'customers' as const, value: customerID } : null,
  ].filter(Boolean)

  await req.payload.create({
    collection: 'activities',
    overrideAccess: true,
    req,
    context: { skipAfterSalesActivity: true },
    data: {
      eventType: status === 'delivered' ? 'shipment.delivered' : 'shipment.status_changed',
      kind: 'delivery',
      occurredAt: new Date().toISOString(),
      summary: status === 'delivered' ? 'Entrega confirmada' : `Status da entrega atualizado para ${status || 'não informado'}`,
      details: doc.lastEvent || undefined,
      owner: req.user?.id,
      relatedTo,
    } as never,
  })

  return doc
}
