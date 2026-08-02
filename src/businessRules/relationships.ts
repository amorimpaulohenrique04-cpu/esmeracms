export type RelationshipValue = number | string | { id?: number | string | null } | null | undefined

export function relationshipID(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

export function sameRelationship(left: RelationshipValue, right: RelationshipValue) {
  const leftID = relationshipID(left)
  const rightID = relationshipID(right)
  return leftID !== null && rightID !== null && String(leftID) === String(rightID)
}
