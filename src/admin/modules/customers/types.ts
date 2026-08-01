export type Relation<T> = string | number | T | null | undefined

export type UserRef = { id: string | number; name?: string | null; email?: string | null }
export type CategoryRef = { id: string | number; title?: string | null; slug?: string | null }
export type ProductRef = { id: string | number; title?: string | null; code?: string | null; catalogStatus?: string | null; availability?: string | null }

export type CustomerStatus = 'active' | 'follow_up' | 'inactive' | 'archived'
export type CustomerTab = 'overview' | 'history' | 'interests' | 'sales' | 'after-sales' | 'notes'

export type CustomerFilters = {
  q: string
  status: CustomerStatus | 'all'
  origin: string
  owner: string
}

export type CustomerListItem = {
  id: string | number
  name?: string | null
  company?: string | null
  phone?: string | null
  email?: string | null
  city?: string | null
  state?: string | null
  status?: CustomerStatus | null
  origin?: string | null
  owner?: Relation<UserRef>
  createdAt?: string | null
  updatedAt?: string | null
  purchaseCount: number
  lifetimeValueCents: number
  lastActivityAt?: string | null
}

export type CustomerDetail = Omit<CustomerListItem, 'purchaseCount' | 'lifetimeValueCents'> & {
  sourceLead?: Relation<{ id: string | number; name?: string | null }>
  interestProfile?: {
    categories?: Array<Relation<CategoryRef>> | null
    materials?: Array<{ value?: string | null }> | null
    investmentMinCents?: number | null
    investmentMaxCents?: number | null
  } | null
  preferences?: Array<{ value?: string | null }> | null
  tags?: Array<{ value?: string | null }> | null
  relationshipNotes?: string | null
  marketingConsent?: boolean | null
  consentRecordedAt?: string | null
  mergedInto?: Relation<{ id: string | number; name?: string | null }>
  mergedAt?: string | null
}

export type SaleSummary = {
  id: string | number
  number?: string | null
  status?: string | null
  totalCents?: number | null
  confirmedAt?: string | null
  updatedAt?: string | null
  items?: Array<{ product?: Relation<ProductRef>; snapshotTitle?: string | null }> | null
}

export type AfterSaleSummary = {
  id: string | number
  status?: string | null
  priority?: string | null
  expectedDeliveryAt?: string | null
  deliveredAt?: string | null
  incidentType?: string | null
  updatedAt?: string | null
  sale?: Relation<{ id: string | number; number?: string | null }>
}

export type ClientInterestSummary = {
  id: string | number
  product?: Relation<ProductRef>
  status?: string | null
  source?: string | null
  owner?: Relation<UserRef>
  notes?: string | null
  addedAt?: string | null
  closedAt?: string | null
  updatedAt?: string | null
}

export type ActivitySummary = {
  id: string | number
  eventType?: string | null
  kind?: string | null
  summary?: string | null
  details?: string | null
  occurredAt?: string | null
  owner?: Relation<UserRef>
  relatedTo?: Array<{ relationTo?: string; value?: Relation<{ id: string | number }> }> | null
}

export type TaskSummary = {
  id: string | number
  title?: string | null
  status?: string | null
  priority?: string | null
  dueAt?: string | null
  assignee?: Relation<UserRef>
  relatedTo?: Array<{ relationTo?: string; value?: Relation<{ id: string | number }> }> | null
}

export function relationId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

export function relationLabel(value: Relation<UserRef> | Relation<ProductRef> | Relation<CategoryRef>, fallback = '—') {
  if (!value || typeof value !== 'object') return fallback
  if ('name' in value && value.name) return value.name
  if ('title' in value && value.title) return value.title
  if ('email' in value && value.email) return value.email
  return fallback
}

export function hasCustomerRelation(items: Array<{ relationTo?: string; value?: unknown }> | null | undefined, customerId: string | number) {
  return Boolean(items?.some((item) => item.relationTo === 'customers' && String(relationId(item.value)) === String(customerId)))
}

export const customerStatusLabels: Record<string, string> = {
  active: 'Ativo',
  follow_up: 'Em acompanhamento',
  inactive: 'Inativo',
  archived: 'Arquivado',
}

export const customerOriginLabels: Record<string, string> = {
  instagram: 'Instagram',
  referral: 'Indicação',
  site: 'Site',
  architect: 'Arquiteto',
  organic: 'Orgânico',
  whatsapp: 'WhatsApp',
  other: 'Outro',
}

export const customerTabLabels: Record<CustomerTab, string> = {
  overview: 'Visão geral',
  history: 'Histórico',
  interests: 'Interesses',
  sales: 'Vendas',
  'after-sales': 'Pós-venda',
  notes: 'Notas',
}

export const saleStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  proposal: 'Proposta enviada',
  negotiation: 'Negociação',
  confirmed: 'Confirmada',
  production: 'Em produção',
  ready: 'Pronta para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
}

export const interestStatusLabels: Record<string, string> = {
  active: 'Ativo',
  curation: 'Em curadoria',
  purchased: 'Convertido em compra',
  paused: 'Pausado',
  archived: 'Arquivado',
}

export const activityEventLabels: Record<string, string> = {
  'sale.created': 'Venda criada',
  'opportunity.stage_changed': 'Etapa da oportunidade alterada',
  'interest.added': 'Interesse adicionado',
  'followup.completed': 'Follow-up concluído',
  'shipment.delivered': 'Entrega realizada',
  'note.created': 'Nota criada',
  'contact.logged': 'Contato registrado',
}
