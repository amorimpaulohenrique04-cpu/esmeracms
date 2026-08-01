import type { CollectionAfterChangeHook } from 'payload'

import { taskStatusLabels, type TaskStatus } from '../../businessRules/afterSales/model'
import { relationshipID } from '../../businessRules/relationships'

function polymorphic(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const item = value as { relationTo?: string; value?: unknown }
  const id = relationshipID(item.value)
  return item.relationTo && id !== null ? { relationTo: item.relationTo, value: id } : null
}

export const recordTaskActivity: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (req.context?.skipAfterSalesActivity) return doc
  const previousStatus = previousDoc?.status as string | undefined
  const status = doc.status as TaskStatus | undefined
  if (operation === 'update' && previousStatus === status) return doc

  const related = Array.isArray(doc.relatedTo) ? doc.relatedTo.map(polymorphic).filter(Boolean) : []
  related.push({ relationTo: 'tasks', value: doc.id })
  const done = status === 'done'

  await req.payload.create({
    collection: 'activities',
    overrideAccess: true,
    req,
    context: { skipAfterSalesActivity: true },
    data: {
      eventType: done ? 'followup.completed' : operation === 'create' ? 'task.created' : 'task.status_changed',
      kind: 'follow_up',
      occurredAt: new Date().toISOString(),
      summary: done ? `Follow-up concluído: ${doc.title}` : operation === 'create' ? `Follow-up criado: ${doc.title}` : `Follow-up atualizado: ${taskStatusLabels[status || 'pending']}`,
      details: doc.notes || undefined,
      owner: relationshipID(doc.assignee) ?? req.user?.id,
      relatedTo: related,
    } as never,
  })

  return doc
}
