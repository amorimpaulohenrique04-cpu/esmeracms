import { ValidationError, type CollectionBeforeValidateHook } from 'payload'

import { relationshipID } from '../../businessRules/relationships'
import {
  canTransitionOpportunity,
  isOpportunityLossReason,
  isOpportunityStage,
  opportunityCode,
  opportunityStageLabels,
  type OpportunityStage,
} from '../../businessRules/opportunities/stages'

export const applyOpportunityRules: CollectionBeforeValidateHook = ({ context, data, originalDoc, req }) => {
  if (!data) return data

  const id = originalDoc?.id as string | number | undefined
  const fromStage = isOpportunityStage(originalDoc?.stage) ? originalDoc.stage : null
  const stageValue = data.stage ?? originalDoc?.stage ?? 'new'
  const errors: Array<{ path: string; message: string }> = []

  if (!isOpportunityStage(stageValue)) {
    errors.push({ path: 'stage', message: 'Etapa comercial inválida.' })
  }

  const stage = isOpportunityStage(stageValue) ? stageValue : 'new'
  if (fromStage && !canTransitionOpportunity(fromStage, stage)) {
    errors.push({
      path: 'stage',
      message: `A transição de “${opportunityStageLabels[fromStage]}” para “${opportunityStageLabels[stage]}” não é permitida.`,
    })
  }

  const customer = data.customer ?? originalDoc?.customer
  const lossReason = data.lossReason ?? originalDoc?.lossReason

  if (stage === 'won' && relationshipID(customer) === null) {
    errors.push({ path: 'customer', message: 'Uma oportunidade ganha precisa estar relacionada a um cliente.' })
  }

  if (stage === 'lost' && !isOpportunityLossReason(lossReason)) {
    errors.push({ path: 'lossReason', message: 'Informe um motivo de perda estruturado.' })
  }

  if (errors.length) {
    throw new ValidationError({ collection: 'opportunities', id, req, errors })
  }

  if (!data.code && !originalDoc?.code) data.code = opportunityCode()
  if (data.rank === undefined && originalDoc?.rank === undefined) data.rank = Date.now()

  const wasClosed = fromStage === 'won' || fromStage === 'lost'
  const isClosed = stage === 'won' || stage === 'lost'
  if (isClosed && !wasClosed) {
    if (data.closedAt) data.closedAt = data.closedAt
    else if (context?.allowMissingLegacyClosedAt) data.closedAt = null
    else data.closedAt = new Date().toISOString()
  } else if (isClosed && originalDoc?.closedAt) data.closedAt = originalDoc.closedAt
  else if (!isClosed) data.closedAt = null

  if (stage === 'won') {
    data.lossReason = null
    data.lossNotes = null
  } else if (stage === 'lost') {
    data.wonSale = null
  } else {
    data.lossReason = null
    data.lossNotes = null
    data.wonSale = null
  }

  return data
}

export function opportunityStage(value: unknown): OpportunityStage {
  return isOpportunityStage(value) ? value : 'new'
}
