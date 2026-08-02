import { randomUUID } from 'node:crypto'

import { ValidationError, type CollectionBeforeValidateHook } from 'payload'

import { relationshipID, sameRelationship, type RelationshipValue } from '../../businessRules/relationships'

type AfterSalesData = {
  caseNumber?: string | null
  sale?: RelationshipValue
  customer?: RelationshipValue
  status?: string | null
  openedAt?: string | null
  closedAt?: string | null
  incidentType?: string | null
  incidentDetails?: string | null
}

function caseNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `POS-${date}-${randomUUID().slice(0, 6).toUpperCase()}`
}

export const applyAfterSalesRules: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const id = originalDoc?.id as number | string | undefined
  const incoming = data as AfterSalesData
  const original = (originalDoc || {}) as AfterSalesData
  const saleID = relationshipID(incoming.sale ?? original.sale)
  const errors: Array<{ path: string; message: string }> = []

  incoming.caseNumber = original.caseNumber || incoming.caseNumber || caseNumber()
  incoming.openedAt = original.openedAt || incoming.openedAt || new Date().toISOString()

  const status = incoming.status ?? original.status ?? 'open'
  if (status === 'resolved' || status === 'closed') incoming.closedAt = original.closedAt || incoming.closedAt || new Date().toISOString()
  else incoming.closedAt = null

  if (saleID !== null) {
    const sale = await req.payload.findByID({
      collection: 'sales',
      id: saleID,
      depth: 0,
      overrideAccess: true,
      req,
      select: { customer: true },
    })
    const saleCustomer = relationshipID(sale.customer)
    const requestedCustomer = relationshipID(incoming.customer ?? original.customer)
    if (requestedCustomer !== null && !sameRelationship(requestedCustomer, saleCustomer)) {
      errors.push({ path: 'customer', message: 'O cliente do pós-venda deve ser o mesmo cliente da venda.' })
    }
    incoming.customer = saleCustomer
  }

  const incidentType = incoming.incidentType ?? original.incidentType ?? 'none'
  const incidentDetails = incoming.incidentDetails ?? original.incidentDetails
  if (incidentType !== 'none' && !String(incidentDetails || '').trim()) {
    errors.push({ path: 'incidentDetails', message: 'Descreva a ocorrência legada ou migre o registro para Occurrences.' })
  }

  if (errors.length) throw new ValidationError({ collection: 'after-sales', id: id ?? undefined, req, errors })
  return data
}
