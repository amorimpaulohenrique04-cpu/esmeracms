import type { RelationshipField } from 'payload'

export function businessUserRelationship(name: string, label: string, required = false): RelationshipField {
  return {
    name,
    type: 'relationship',
    relationTo: 'users',
    label,
    required,
    maxDepth: 1,
    filterOptions: {
      role: { in: ['admin', 'commercial'] },
    },
  }
}
