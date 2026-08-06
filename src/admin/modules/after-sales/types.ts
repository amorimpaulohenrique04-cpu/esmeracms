import type {
  AfterSalesStatus,
  OccurrenceSeverity,
  OccurrenceStatus,
  OccurrenceType,
  OperationalPriority,
  ShipmentStatus,
  TaskStatus,
  TaskType,
} from '../../../businessRules/afterSales/model'

export type Relation<T extends { id: string | number }> = T | string | number | null | undefined
export type PolyRelation = { relationTo?: string; value?: Relation<{ id: string | number }> }

export type CustomerRef = {
  id: string | number
  name?: string | null
  company?: string | null
  phone?: string | null
  email?: string | null
}

export type SaleRef = {
  id: string | number
  number?: string | null
  status?: string | null
  totalCents?: number | null
  confirmedAt?: string | null
  expectedDeliveryAt?: string | null
}

export type UserRef = {
  id: string | number
  name?: string | null
  email?: string | null
}

export type AfterSalesCase = {
  id: string | number
  caseNumber?: string | null
  sale?: Relation<SaleRef>
  customer?: Relation<CustomerRef>
  status?: AfterSalesStatus | null
  priority?: OperationalPriority | null
  owner?: Relation<UserRef>
  summary?: string | null
  openedAt?: string | null
  closedAt?: string | null
  updatedAt?: string | null
}

export type TaskRecord = {
  id: string | number
  title?: string | null
  type?: TaskType | null
  status?: TaskStatus | null
  priority?: OperationalPriority | null
  dueAt?: string | null
  assignee?: Relation<UserRef>
  relatedTo?: PolyRelation[] | null
  notes?: string | null
  completedAt?: string | null
  updatedAt?: string | null
}

export type ShipmentRecord = {
  id: string | number
  afterSalesCase?: Relation<AfterSalesCase>
  sale?: Relation<SaleRef>
  customer?: Relation<CustomerRef>
  carrier?: string | null
  trackingCode?: string | null
  status?: ShipmentStatus | null
  estimatedDelivery?: string | null
  deliveredAt?: string | null
  lastEvent?: string | null
  notes?: string | null
  updatedAt?: string | null
}

export type OccurrenceRecord = {
  id: string | number
  afterSalesCase?: Relation<AfterSalesCase>
  sale?: Relation<SaleRef>
  customer?: Relation<CustomerRef>
  type?: OccurrenceType | null
  severity?: OccurrenceSeverity | null
  status?: OccurrenceStatus | null
  owner?: Relation<UserRef>
  description?: string | null
  resolution?: string | null
  openedAt?: string | null
  closedAt?: string | null
  updatedAt?: string | null
}

export type ActivityRecord = {
  id: string | number
  eventType?: string | null
  kind?: string | null
  occurredAt?: string | null
  summary?: string | null
  details?: string | null
  owner?: Relation<UserRef>
  relatedTo?: PolyRelation[] | null
}

export type SaleOption = {
  id: string | number
  number?: string | null
  customer?: Relation<CustomerRef>
}

export type QueueFocus = 'all' | 'today' | 'overdue' | 'occurrences' | 'deliveries'

export type AfterSalesFilters = {
  focus: QueueFocus
  q: string
  owner: string
  priority: string
  type: string
  status: string
}
