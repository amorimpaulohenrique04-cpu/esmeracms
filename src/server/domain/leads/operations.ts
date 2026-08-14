import type { Payload } from 'payload'

import { relationshipID } from '../../../businessRules/relationships'

type WorkflowUser = { id?: string | number } | null | undefined

type LeadDocument = {
  id: string | number
  name?: string | null
  phone?: string | null
  email?: string | null
  source?: string | null
  owner?: unknown
  interestedProducts?: unknown
  customer?: unknown
  opportunity?: unknown
}

export type CreateLeadInput = {
  name: string
  phone?: string | null
  email?: string | null
  source: string
  notes?: string | null
}

function userOption(user: WorkflowUser) {
  return user as never
}

export async function createLead(payload: Payload, user: WorkflowUser, input: CreateLeadInput) {
  if (!input.name.trim()) throw new Error('Informe o nome do lead.')
  if (!input.phone?.trim() && !input.email?.trim()) throw new Error('Informe telefone ou e-mail.')
  if (!input.source) throw new Error('Informe a origem do lead.')

  const lead = await payload.create({
    collection: 'leads',
    overrideAccess: false,
    user: userOption(user),
    data: {
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      source: input.source,
      owner: user?.id || undefined,
      notes: input.notes?.trim() || null,
    } as never,
  })
  return { lead }
}

export async function deleteLead(payload: Payload, user: WorkflowUser, leadId: string | number) {
  await payload.delete({
    collection: 'leads',
    id: leadId,
    overrideAccess: false,
    user: userOption(user),
  })
  return { id: leadId }
}

export async function qualifyLead(payload: Payload, user: WorkflowUser, leadId: string | number) {
  const lead = await payload.findByID({
    collection: 'leads',
    id: leadId,
    depth: 0,
    overrideAccess: false,
    user: userOption(user),
  }) as unknown as LeadDocument

  let customerID = relationshipID(lead.customer)
  if (customerID === null) {
    const customerCandidates = await payload.find({
      collection: 'customers',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: false,
      user: userOption(user),
      where: {
        or: [
          { sourceLead: { equals: leadId } },
          ...(lead.phone ? [{ phone: { equals: lead.phone } }] : []),
          ...(lead.email ? [{ email: { equals: lead.email } }] : []),
        ],
      },
    })
    const customer = customerCandidates.docs[0] || await payload.create({
      collection: 'customers',
      overrideAccess: false,
      user: userOption(user),
      data: {
        name: lead.name || `Lead ${lead.id}`,
        phone: lead.phone || null,
        email: lead.email || null,
        origin: lead.source || 'other',
        owner: relationshipID(lead.owner) || user?.id || undefined,
        sourceLead: leadId,
        status: 'active',
      } as never,
    })
    customerID = customer.id
  }

  const linkedId = relationshipID(lead.opportunity)
  const existing = await payload.find({
    collection: 'opportunities',
    where: { sourceLead: { equals: leadId } },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user: userOption(user),
  })
  let opportunity = linkedId !== null
    ? await payload.findByID({ collection: 'opportunities', id: linkedId, overrideAccess: false, user: userOption(user) })
    : existing.docs[0]

  if (!opportunity) opportunity = await payload.create({
    collection: 'opportunities',
    overrideAccess: false,
    user: userOption(user),
    data: {
      source: lead.source || 'other',
      customer: customerID,
      interestedProducts: lead.interestedProducts,
      owner: relationshipID(lead.owner) || user?.id || undefined,
      sourceLead: leadId,
    } as never,
  })
  else if (relationshipID(opportunity.customer) === null) {
    opportunity = await payload.update({
      collection: 'opportunities',
      id: opportunity.id,
      overrideAccess: false,
      user: userOption(user),
      data: { customer: customerID, source: lead.source || 'other' } as never,
    })
  }

  await payload.update({
    collection: 'leads',
    id: leadId,
    overrideAccess: false,
    user: userOption(user),
    data: { customer: customerID, opportunity: opportunity.id, opportunityMigratedAt: new Date().toISOString() } as never,
  })

  return { customerID, opportunity }
}
