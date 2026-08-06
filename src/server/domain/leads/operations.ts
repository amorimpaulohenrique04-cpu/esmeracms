import type { Payload } from 'payload'

import { relationshipID } from '../../../businessRules/relationships'

type WorkflowUser = { id?: string | number } | null | undefined

type LeadDocument = {
  id: string | number
  source?: string | null
  owner?: unknown
  interestedProducts?: unknown
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

export async function qualifyLead(payload: Payload, user: WorkflowUser, leadId: string | number) {
  const lead = await payload.findByID({
    collection: 'leads',
    id: leadId,
    depth: 0,
    overrideAccess: false,
    user: userOption(user),
  }) as unknown as LeadDocument

  const linkedId = relationshipID(lead.opportunity)
  if (linkedId !== null) {
    const opportunity = await payload.findByID({ collection: 'opportunities', id: linkedId, overrideAccess: false, user: userOption(user) })
    return { opportunity }
  }

  const existing = await payload.find({
    collection: 'opportunities',
    where: { sourceLead: { equals: leadId } },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user: userOption(user),
  })
  const opportunity = existing.docs.length ? existing.docs[0] : await payload.create({
    collection: 'opportunities',
    overrideAccess: false,
    user: userOption(user),
    data: {
      source: lead.source || 'other',
      interestedProducts: lead.interestedProducts,
      owner: relationshipID(lead.owner) || user?.id || undefined,
      sourceLead: leadId,
    } as never,
  })

  await payload.update({
    collection: 'leads',
    id: leadId,
    overrideAccess: false,
    user: userOption(user),
    data: { opportunity: opportunity.id } as never,
  })

  return { opportunity }
}
