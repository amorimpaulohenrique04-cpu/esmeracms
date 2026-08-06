export const activityKinds = [
  'contact',
  'message',
  'proposal',
  'stage_change',
  'sale',
  'note',
  'delivery',
  'follow_up',
  'occurrence',
] as const

export type ActivityKind = typeof activityKinds[number]

export const activityEventTypeToKind: Record<string, ActivityKind> = {
  'opportunity.created': 'contact',
  'opportunity.migrated': 'stage_change',
  'sale.created': 'sale',
  'opportunity.stage_changed': 'stage_change',
  'interest.added': 'note',
  'task.created': 'follow_up',
  'task.status_changed': 'follow_up',
  'followup.completed': 'follow_up',
  'shipment.status_changed': 'delivery',
  'shipment.delivered': 'delivery',
  'occurrence.opened': 'occurrence',
  'occurrence.status_changed': 'occurrence',
  'occurrence.resolved': 'occurrence',
  'note.created': 'note',
  'contact.logged': 'contact',
}

export function deriveActivityKind(eventType: unknown): ActivityKind | null {
  if (typeof eventType !== 'string') return null
  return activityEventTypeToKind[eventType] || null
}
