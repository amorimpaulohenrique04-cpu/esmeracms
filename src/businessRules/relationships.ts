export type RelationshipValue = number | string | { id?: number | string | null } | null | undefined

export function relationshipID(value: RelationshipValue): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && (typeof value.id === 'number' || typeof value.id === 'string')) {
    return value.id
  }
  return null
}

export function sameRelationship(left: RelationshipValue, right: RelationshipValue) {
  const leftID = relationshipID(left)
  const rightID = relationshipID(right)
  return leftID !== null && rightID !== null && String(leftID) === String(rightID)
}
