import { randomUUID } from 'node:crypto'

export const opportunityStages = ['new', 'curation', 'proposal', 'negotiation', 'won', 'lost'] as const
export type OpportunityStage = typeof opportunityStages[number]

export const openOpportunityStages = ['new', 'curation', 'proposal', 'negotiation'] as const
export const migratedLeadStages = ['curation', 'proposal', 'negotiation', 'won', 'lost'] as const

export const opportunityStageLabels: Record<OpportunityStage, string> = {
  new: 'Novo',
  curation: 'Em Qualificação',
  proposal: 'Proposta Enviada',
  negotiation: 'Em Negociação',
  won: 'Ganho',
  lost: 'Perdido',
}

export const opportunityLossReasons = [
  'price',
  'budget',
  'timing',
  'no_response',
  'product_fit',
  'competitor',
  'changed_mind',
  'other',
] as const
export type OpportunityLossReason = typeof opportunityLossReasons[number]

export const opportunityLossReasonLabels: Record<OpportunityLossReason, string> = {
  price: 'Preço',
  budget: 'Orçamento indisponível',
  timing: 'Momento inadequado',
  no_response: 'Sem retorno',
  product_fit: 'Aderência ao produto',
  competitor: 'Escolheu concorrente',
  changed_mind: 'Mudança de decisão',
  other: 'Outro',
}

export const OPPORTUNITY_MIGRATION_VERSION = 'lead-stage-v1'
export const DEFAULT_OPPORTUNITY_REPORTING_CUTOVER_AT = '2026-08-01T00:00:00.000Z'

const transitionMap: Record<OpportunityStage, readonly OpportunityStage[]> = {
  new: ['curation', 'lost'],
  curation: ['new', 'proposal', 'lost'],
  proposal: ['curation', 'negotiation', 'won', 'lost'],
  negotiation: ['proposal', 'won', 'lost'],
  won: [],
  lost: [],
}

export function isOpportunityStage(value: unknown): value is OpportunityStage {
  return opportunityStages.includes(value as OpportunityStage)
}

export function isOpportunityLossReason(value: unknown): value is OpportunityLossReason {
  return opportunityLossReasons.includes(value as OpportunityLossReason)
}

export function canTransitionOpportunity(from: OpportunityStage | null | undefined, to: OpportunityStage) {
  if (!from || from === to) return true
  return transitionMap[from].includes(to)
}

export function opportunityCode() {
  return `OPP-${randomUUID().slice(0, 8).toUpperCase()}`
}

export function migratedOpportunityCode(leadID: string | number) {
  const safe = String(leadID).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase()
  return `OPP-L-${safe}`
}

export function opportunityReportingCutoverAt() {
  const configured = process.env.OPPORTUNITY_FUNNEL_CUTOVER_AT?.trim()
  if (!configured) return DEFAULT_OPPORTUNITY_REPORTING_CUTOVER_AT
  return Number.isNaN(new Date(configured).getTime()) ? DEFAULT_OPPORTUNITY_REPORTING_CUTOVER_AT : new Date(configured).toISOString()
}
