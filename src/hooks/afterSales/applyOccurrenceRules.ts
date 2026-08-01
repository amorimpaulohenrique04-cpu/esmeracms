import { ValidationError, type CollectionAfterChangeHook, type CollectionBeforeValidateHook } from 'payload'

import { relationshipID, type RelationshipValue } from '../../businessRules/relationships'

type OccurrenceData = {
  afterSalesCase?: RelationshipValue
  sale?: RelationshipValue
  customer?: RelationshipValue
  status?: string | null
  resolution?: string | null
  openedAt?: string | null
  closedAt?: string | null
  description?: string | null
  type?: string | null
  severity?: string | null
}

export const applyOccurrenceRules: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const incoming = data as OccurrenceData
  const original = (originalDoc || {}) as OccurrenceData
  const caseID = relationshipID(incoming.afterSalesCase ?? original.afterSalesCase)
  const status = incoming.status ?? original.status ?? 'open'

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

  incoming.openedAt = original.openedAt || incoming.openedAt || new Date().toISOString()
  if (status === 'resolved' || status === 'closed') {
    incoming.closedAt = original.closedAt || incoming.closedAt || new Date().toISOString()
    if (!String(incoming.resolution ?? original.resolution ?? '').trim()) {
      throw new ValidationError({
        collection: 'occurrences',
        id: originalDoc?.id,
        req,
        errors: [{ path: 'resolution', message: 'Registre a resolução antes de resolver ou encerrar a ocorrência.' }],
      })
    }
  } else {
    incoming.closedAt = null
  }

  return data
}

export const recordOccurrenceActivity: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (req.context?.skipAfterSalesActivity) return doc
  const previousStatus = previousDoc?.status as string | undefined
  const status = doc.status as string | undefined
  if (operation === 'update' && previousStatus === status) return doc

  const caseID = relationshipID(doc.afterSalesCase)
  const saleID = relationshipID(doc.sale)
  const customerID = relationshipID(doc.customer)
  const relatedTo = [
    caseID !== null ? { relationTo: 'after-sales' as const, value: caseID } : null,
    { relationTo: 'occurrences' as const, value: doc.id },
    saleID !== null ? { relationTo: 'sales' as const, value: saleID } : null,
    customerID !== null ? { relationTo: 'customers' as const, value: customerID } : null,
  ].filter(Boolean)

  const resolved = status === 'resolved' || status === 'closed'
  await req.payload.create({
    collection: 'activities',
    overrideAccess: true,
    req,
    context: { skipAfterSalesActivity: true },
    data: {
      eventType: resolved ? 'occurrence.resolved' : operation === 'create' ? 'occurrence.opened' : 'occurrence.status_changed',
      kind: 'follow_up',
      occurredAt: new Date().toISOString(),
      summary: resolved ? 'Ocorrência resolvida' : operation === 'create' ? 'Ocorrência aberta' : `Status da ocorrência atualizado para ${status || 'não informado'}`,
      details: resolved ? doc.resolution : doc.description,
      owner: req.user?.id,
      relatedTo,
    } as never,
  })

  return doc
}
