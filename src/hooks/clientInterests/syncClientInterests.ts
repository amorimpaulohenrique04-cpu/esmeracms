import type { Payload, PayloadRequest } from 'payload'

type WorkflowUser = { id?: string | number } | null | undefined

export type ClientInterestSource = 'manual' | 'lead' | 'sale' | 'after_sale'

function canonicalRelationshipID(value: string | number) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return trimmed
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) ? parsed : trimmed
}

/**
 * Upsert-style sync: reuses an existing open interest for the same customer/product
 * instead of creating a duplicate row, since Leads/Opportunities/Sales can all
 * point at the same product interest for the same customer over time.
 */
export async function syncClientInterest(
  payload: Payload,
  user: WorkflowUser,
  input: { customerId: string | number; productId: string | number; source: ClientInterestSource; status?: string },
  req?: PayloadRequest,
) {
  const customerId = canonicalRelationshipID(input.customerId)
  const productId = canonicalRelationshipID(input.productId)
  const existing = await payload.find({
    collection: 'client-interests',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: { and: [{ customer: { equals: customerId } }, { product: { equals: productId } }] },
    req,
  })

  if (existing.docs.length) {
    const current = existing.docs[0]
    if (input.status && current.status !== input.status) {
      return await payload.update({
        collection: 'client-interests',
        id: current.id,
        overrideAccess: true,
        data: { status: input.status } as never,
        req,
      })
    }
    return current
  }

  return await payload.create({
    collection: 'client-interests',
    overrideAccess: true,
    data: {
      customer: customerId,
      product: productId,
      status: input.status || 'active',
      source: input.source,
      owner: user?.id || undefined,
      addedAt: new Date().toISOString(),
    } as never,
    req,
  })
}

export async function syncClientInterests(
  payload: Payload,
  user: WorkflowUser,
  input: { customerId: string | number; productIds: Array<string | number>; source: ClientInterestSource; status?: string },
  req?: PayloadRequest,
) {
  for (const productId of input.productIds) {
    await syncClientInterest(payload, user, { customerId: input.customerId, productId, source: input.source, status: input.status }, req)
  }
}
