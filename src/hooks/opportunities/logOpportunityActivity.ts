import type { CollectionAfterChangeHook } from 'payload'

import { relationshipID } from '../../businessRules/relationships'
import { isOpportunityStage, opportunityStageLabels } from '../../businessRules/opportunities/stages'

export const logOpportunityActivity: CollectionAfterChangeHook = async ({ context, doc, operation, previousDoc, req }) => {
  if (context?.skipOpportunityActivity) return doc

  const stage = isOpportunityStage(doc.stage) ? doc.stage : 'new'
  const previousStage = isOpportunityStage(previousDoc?.stage) ? previousDoc.stage : null
  if (operation === 'update' && previousStage === stage) return doc

  const relatedTo: Array<{ relationTo: 'opportunities' | 'customers'; value: string | number }> = [
    { relationTo: 'opportunities', value: doc.id },
  ]
  const customerID = relationshipID(doc.customer)
  if (customerID !== null) relatedTo.push({ relationTo: 'customers', value: customerID })

  await req.payload.create({
    collection: 'activities',
    overrideAccess: true,
    req,
    context: { skipOpportunityActivity: true },
    data: {
      eventType: operation === 'create' ? 'opportunity.created' : 'opportunity.stage_changed',
      kind: operation === 'create' ? 'contact' : 'stage_change',
      occurredAt: new Date().toISOString(),
      summary: operation === 'create'
        ? `Oportunidade ${doc.code || doc.id} criada em ${opportunityStageLabels[stage]}`
        : `Oportunidade ${doc.code || doc.id}: ${previousStage ? opportunityStageLabels[previousStage] : 'Sem etapa'} → ${opportunityStageLabels[stage]}`,
      details: stage === 'lost' && doc.lossReason ? `Motivo: ${doc.lossReason}${doc.lossNotes ? ` · ${doc.lossNotes}` : ''}` : undefined,
      owner: relationshipID(doc.owner) ?? req.user?.id ?? undefined,
      opportunity: doc.id,
      fromStage: previousStage || undefined,
      toStage: stage,
      lossReason: stage === 'lost' ? doc.lossReason || undefined : undefined,
      relatedTo,
    } as never,
  })

  return doc
}
