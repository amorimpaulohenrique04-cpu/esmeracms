import { ValidationError, type CollectionBeforeChangeHook } from 'payload'

import { relationshipID } from '../../businessRules/relationships'

export const applyLeadRules: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!data) return data
  const id = originalDoc?.id as number | string | undefined
  const stage = data.stage ?? originalDoc?.stage
  const customer = data.customer ?? originalDoc?.customer
  const wasClosed = originalDoc?.stage === 'won' || originalDoc?.stage === 'lost'
  const isClosed = stage === 'won' || stage === 'lost'

  if (stage === 'won' && relationshipID(customer) === null) {
    throw new ValidationError({
      collection: 'leads',
      id: id ?? undefined,
      req,
      errors: [{ path: 'customer', message: 'Um lead ganho precisa estar relacionado a um cliente.' }],
    })
  }

  if (isClosed && !wasClosed) data.closedAt = new Date().toISOString()
  else if (isClosed && originalDoc?.closedAt) data.closedAt = originalDoc.closedAt
  else data.closedAt = null

  return data
}
