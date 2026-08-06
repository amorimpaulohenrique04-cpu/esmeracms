import type { CollectionBeforeValidateHook } from 'payload'

import { deriveActivityKind as kindFromEventType } from '../../businessRules/activities/eventTaxonomy'

export const deriveActivityKind: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data
  const derived = kindFromEventType(data.eventType)
  if (derived) data.kind = derived
  return data
}
