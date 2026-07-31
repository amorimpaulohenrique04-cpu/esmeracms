import type { PayloadRequest } from 'payload'

import { relationshipID, type RelationshipValue } from '../relationships'

type CategoryNode = {
  id?: string | number
  title?: string | null
  parent?: RelationshipValue
}

export async function getCategoryHierarchyIssues(
  req: PayloadRequest,
  categoryId: string | number | null | undefined,
  parentValue: RelationshipValue,
) {
  const parentId = relationshipID(parentValue)
  if (parentId === null) return []

  const categoryKey = categoryId === null || categoryId === undefined ? null : String(categoryId)
  if (categoryKey && String(parentId) === categoryKey) return ['Uma categoria não pode ser a própria categoria principal.']

  const visited = new Set<string>()
  let currentId: string | number | null = parentId

  for (let depth = 0; currentId !== null && depth < 100; depth += 1) {
    const currentKey = String(currentId)
    if (categoryKey && currentKey === categoryKey) return ['A categoria principal criaria um ciclo na hierarquia.']
    if (visited.has(currentKey)) return ['A hierarquia existente contém um ciclo e precisa ser corrigida antes desta alteração.']
    visited.add(currentKey)

    let current: CategoryNode
    try {
      current = await req.payload.findByID({
        collection: 'categories',
        id: currentId,
        depth: 0,
        draft: true,
        overrideAccess: true,
        req,
      }) as unknown as CategoryNode
    } catch {
      return ['A categoria principal selecionada não existe.']
    }

    currentId = relationshipID(current.parent)
  }

  if (currentId !== null) return ['A hierarquia excede o limite seguro de profundidade.']
  return []
}
