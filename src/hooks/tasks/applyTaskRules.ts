import type { CollectionBeforeChangeHook } from 'payload'

export const applyTaskRules: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (!data) return data
  const status = data.status ?? originalDoc?.status
  const wasDone = originalDoc?.status === 'done'

  if (status === 'done' && !wasDone) data.completedAt = new Date().toISOString()
  else if (status === 'done' && originalDoc?.completedAt) data.completedAt = originalDoc.completedAt
  else data.completedAt = null

  return data
}
