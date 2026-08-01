export const afterSalesStatuses = ['open', 'following', 'resolved', 'closed'] as const
export type AfterSalesStatus = typeof afterSalesStatuses[number]

export const afterSalesStatusLabels: Record<AfterSalesStatus, string> = {
  open: 'Aberto',
  following: 'Acompanhando',
  resolved: 'Resolvido',
  closed: 'Encerrado',
}

export const operationalPriorities = ['low', 'normal', 'high', 'urgent'] as const
export type OperationalPriority = typeof operationalPriorities[number]

export const operationalPriorityLabels: Record<OperationalPriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

export const taskTypes = [
  'delivery_confirmation',
  'satisfaction',
  'testimonial',
  'maintenance',
  'curation',
  'custom',
] as const
export type TaskType = typeof taskTypes[number]

export const taskTypeLabels: Record<TaskType, string> = {
  delivery_confirmation: 'Confirmar entrega',
  satisfaction: 'Satisfação',
  testimonial: 'Foto ou depoimento',
  maintenance: 'Manutenção preventiva',
  curation: 'Nova curadoria',
  custom: 'Personalizado',
}

export const taskStatuses = ['pending', 'in_progress', 'done', 'cancelled'] as const
export type TaskStatus = typeof taskStatuses[number]

export const taskStatusLabels: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
}

export const shipmentStatuses = [
  'confirmed',
  'collected',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'cancelled',
] as const
export type ShipmentStatus = typeof shipmentStatuses[number]

export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  confirmed: 'Pedido confirmado',
  collected: 'Coletado',
  in_transit: 'Em trânsito',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  exception: 'Ocorrência logística',
  cancelled: 'Cancelado',
}

export const shipmentProgressStatuses: ShipmentStatus[] = [
  'confirmed',
  'collected',
  'in_transit',
  'out_for_delivery',
  'delivered',
]

export const occurrenceTypes = [
  'damage',
  'adjustment',
  'maintenance',
  'delivery_delay',
  'return',
  'other',
] as const
export type OccurrenceType = typeof occurrenceTypes[number]

export const occurrenceTypeLabels: Record<OccurrenceType, string> = {
  damage: 'Avaria',
  adjustment: 'Ajuste',
  maintenance: 'Manutenção',
  delivery_delay: 'Atraso de entrega',
  return: 'Troca ou devolução',
  other: 'Outro',
}

export const occurrenceSeverities = ['low', 'medium', 'high', 'critical'] as const
export type OccurrenceSeverity = typeof occurrenceSeverities[number]

export const occurrenceSeverityLabels: Record<OccurrenceSeverity, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}

export const occurrenceStatuses = ['open', 'investigating', 'waiting_customer', 'resolved', 'closed'] as const
export type OccurrenceStatus = typeof occurrenceStatuses[number]

export const occurrenceStatusLabels: Record<OccurrenceStatus, string> = {
  open: 'Aberta',
  investigating: 'Em análise',
  waiting_customer: 'Aguardando cliente',
  resolved: 'Resolvida',
  closed: 'Encerrada',
}

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && taskTypes.includes(value as TaskType)
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && taskStatuses.includes(value as TaskStatus)
}

export function isShipmentStatus(value: unknown): value is ShipmentStatus {
  return typeof value === 'string' && shipmentStatuses.includes(value as ShipmentStatus)
}

export function isOccurrenceType(value: unknown): value is OccurrenceType {
  return typeof value === 'string' && occurrenceTypes.includes(value as OccurrenceType)
}

export function isOccurrenceSeverity(value: unknown): value is OccurrenceSeverity {
  return typeof value === 'string' && occurrenceSeverities.includes(value as OccurrenceSeverity)
}

export function isOccurrenceStatus(value: unknown): value is OccurrenceStatus {
  return typeof value === 'string' && occurrenceStatuses.includes(value as OccurrenceStatus)
}

export function isAfterSalesStatus(value: unknown): value is AfterSalesStatus {
  return typeof value === 'string' && afterSalesStatuses.includes(value as AfterSalesStatus)
}
