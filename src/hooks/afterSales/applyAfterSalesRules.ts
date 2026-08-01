import { randomUUID } from 'node:crypto'

import { ValidationError, type CollectionBeforeValidateHook } from 'payload'

import { relationshipID, sameRelationship, type RelationshipValue } from '../../businessRules/relationships'

type FollowUp = {
  id?: number | string | null
  status?: string | null
  completedAt?: string | null
  [key: string]: unknown
}

type AfterSalesData = {
  caseNumber?: string | null
  sale?: RelationshipValue
  customer?: RelationshipValue
  status?: string | null
  openedAt?: string | null
  closedAt?: string | null
  followUps?: FollowUp[] | null
}

function previousFollowUp(items: FollowUp[], item: FollowUp, index: number) {
  if (item.id !== undefined && item.id !== null) {
    return items.find((candidate) => candidate.id !== undefined && String(candidate.id) === String(item.id)) || items[index]
  }
  return items[index]
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

  if (Array.isArray(incoming.followUps)) {
    const previousItems = original.followUps || []
    incoming.followUps = incoming.followUps.map((followUp, index) => {
      const previous = previousFollowUp(previousItems, followUp, index)
      const wasDone = previous?.status === 'done'
      if (followUp.status === 'done' && !wasDone) return { ...followUp, completedAt: new Date().toISOString() }
      if (followUp.status === 'done' && previous?.completedAt) return { ...followUp, completedAt: previous.completedAt }
      return { ...followUp, completedAt: null }
    })
  }

  if (errors.length) throw new ValidationError({ collection: 'after-sales', id: id ?? undefined, req, errors })
  return data
}
