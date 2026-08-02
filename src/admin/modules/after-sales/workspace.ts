import {
  occurrenceSeverityLabels,
  occurrenceStatusLabels,
  operationalPriorityLabels,
  shipmentStatusLabels,
  taskStatusLabels,
  type OccurrenceSeverity,
  type OccurrenceStatus,
  type OperationalPriority,
  type ShipmentStatus,
  type TaskStatus,
} from '../../../businessRules/afterSales/model'
import type { ActivityRecord, AfterSalesFilters, TaskRecord } from './types'

export type QueueKind = 'task' | 'occurrence' | 'shipment'

export type QueueRow = {
  key: string
  id: string | number
  kind: QueueKind
  caseId: string | number | null
  dueAt: string | null
  priority: string
  ownerId: string | number | null
  ownerLabel: string
  customer: string
  caseNumber: string
  title: string
  subtitle: string
  status: string
  type: string
}

export function relationId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (!value || typeof value !== 'object') return null
  const item = value as { id?: unknown; value?: unknown }
  if (typeof item.id === 'string' || typeof item.id === 'number') return item.id
  return relationId(item.value)
}

export function relationLabel(value: unknown, fallback = '—') {
  if (!value || typeof value !== 'object') return fallback
  const item = value as { name?: string | null; email?: string | null; number?: string | null; caseNumber?: string | null }
  return item.name || item.number || item.caseNumber || item.email || fallback
}

export function polyId(values: TaskRecord['relatedTo'] | ActivityRecord['relatedTo'], relationTo: string) {
  const match = values?.find((item) => item?.relationTo === relationTo)
  return relationId(match?.value)
}

export function dateTime(value?: string | null) {
  if (!value) return 'Sem prazo'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem prazo'
  return date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function shortDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function money(cents?: number | null) {
  if (typeof cents !== 'number') return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function dayKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

export function openTask(task: TaskRecord) {
  return task.status === 'pending' || task.status === 'in_progress'
}

export function openOccurrence(occurrence: { status?: string | null }) {
  return occurrence.status !== 'resolved' && occurrence.status !== 'closed'
}

export function activeShipment(shipment: { status?: string | null }) {
  return shipment.status !== 'delivered' && shipment.status !== 'cancelled'
}

export function priorityTone(value: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (value === 'urgent' || value === 'critical') return 'danger'
  if (value === 'high') return 'warning'
  if (value === 'medium') return 'info'
  return 'neutral'
}

export function statusTone(kind: QueueKind, status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (['done', 'delivered', 'resolved', 'closed'].includes(status)) return 'success'
  if (['cancelled', 'exception'].includes(status)) return 'danger'
  if (kind === 'occurrence') return 'warning'
  if (status === 'in_progress' || status === 'in_transit' || status === 'out_for_delivery') return 'info'
  return 'neutral'
}

export function queueStatusLabel(row: QueueRow) {
  if (row.kind === 'task') return taskStatusLabels[row.status as TaskStatus]
  if (row.kind === 'occurrence') return occurrenceStatusLabels[row.status as OccurrenceStatus]
  return shipmentStatusLabels[row.status as ShipmentStatus]
}

export function queuePriorityLabel(value: string) {
  return operationalPriorityLabels[value as OperationalPriority] || occurrenceSeverityLabels[value as OccurrenceSeverity] || value
}

export async function postAfterSales(body: Record<string, unknown>) {
  const response = await fetch('/api/admin-after-sales', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json() as Record<string, unknown> & { error?: string }
  if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar o pós-venda.')
  return result
}

export function filterHref(filters: AfterSalesFilters, focus: AfterSalesFilters['focus']) {
  const params = new URLSearchParams()
  params.set('focus', focus)
  if (filters.q) params.set('q', filters.q)
  if (filters.owner) params.set('owner', filters.owner)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.type) params.set('type', filters.type)
  if (filters.status && filters.status !== 'open') params.set('status', filters.status)
  return `/admin/after-sales?${params.toString()}`
}
