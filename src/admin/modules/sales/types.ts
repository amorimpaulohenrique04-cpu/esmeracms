export type Relation<T> = T | string | number | null | undefined

export type CustomerRef = {
  id: string | number
  name?: string | null
  company?: string | null
  phone?: string | null
  email?: string | null
}

export type UserRef = {
  id: string | number
  name?: string | null
  email?: string | null
}

export type ProductVariantRef = {
  sku?: string | null
  status?: string | null
  priceMode?: 'fixed' | 'inherit' | 'inquiry' | null
  priceCents?: number | null
  selection?: Array<{ option?: string | null; value?: string | null }> | null
}

export type ProductRef = {
  id: string | number
  title?: string | null
  code?: string | null
  slug?: string | null
  priceMode?: 'fixed' | 'inquiry' | null
  basePriceCents?: number | null
  variants?: ProductVariantRef[] | null
}

export type SaleRef = {
  id: string | number
  number?: string | null
  status?: string | null
  totalCents?: number | null
  confirmedAt?: string | null
}

export type OpportunityRecord = {
  id: string | number
  code?: string | null
  stage?: string | null
  rank?: number | null
  customer?: Relation<CustomerRef>
  owner?: Relation<UserRef>
  source?: string | null
  priority?: string | null
  interestedProducts: Array<Relation<ProductRef>>
  estimatedValueCents?: number | null
  nextAction?: string | null
  nextActionAt?: string | null
  expectedCloseAt?: string | null
  closedAt?: string | null
  lossReason?: string | null
  lossNotes?: string | null
  wonSale?: Relation<SaleRef>
  createdAt?: string | null
  updatedAt?: string | null
}

export type ActivityRecord = {
  id: string | number
  eventType?: string | null
  summary?: string | null
  details?: string | null
  occurredAt?: string | null
  fromStage?: string | null
  toStage?: string | null
  lossReason?: string | null
  owner?: Relation<UserRef>
  opportunity?: Relation<OpportunityRecord>
}

export type SalesTransaction = {
  id: string | number
  number?: string | null
  status?: string | null
  totalCents?: number | null
  channel?: string | null
  customer?: Relation<CustomerRef>
  opportunity?: Relation<OpportunityRecord>
  confirmedAt?: string | null
  expectedDeliveryAt?: string | null
  updatedAt?: string | null
}

export type SalesMode = 'list' | 'pipeline'
export type OpportunityPeriod = 'all' | 'overdue' | 'today' | '7d' | '30d'

export type SalesWorkspaceFilters = {
  view: SalesMode
  q: string
  owner: string
  source: string
  stage: string
  period: OpportunityPeriod
  page: number
  limit: 25 | 50 | 100
  sort: string
}

export const sourceLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  site: 'Site',
  referral: 'Indicação',
  architect: 'Arquiteto',
  organic: 'Orgânico',
  other: 'Outro',
}

export const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

export const saleStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  proposal: 'Proposta legada',
  negotiation: 'Negociação legada',
  confirmed: 'Confirmada',
  production: 'Em produção',
  ready: 'Pronta para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
}

export function relationId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

export function relationLabel(value: Relation<CustomerRef | UserRef>, fallback = '—') {
  if (!value || typeof value !== 'object') return fallback
  if ('name' in value && value.name) return value.name
  if ('email' in value && value.email) return value.email
  return fallback
}
