import type { PayloadRequest } from 'payload'

import { decorateIssues } from '../../issues/build'
import { ISSUE_CODES } from '../../issues/codes'
import type { PublicationIssue, RawIssue } from '../../issues/types'
import { relationshipID, type RelationshipValue } from '../relationships'

type CategoryNode = {
  id?: string | number
  title?: string | null
  parent?: RelationshipValue
}

const blocker = (code: string): RawIssue[] => [{
  code,
  severity: 'blocker',
  path: 'parent',
  source: 'readiness',
}]

/**
 * Decisão pura sobre a hierarquia: retorna no máximo uma pendência, e cada
 * condição tem código próprio. Antes as cinco condições viravam strings
 * indistinguíveis, que `Categories.ts` concatenava num `APIError` sem path.
 */
export async function collectCategoryHierarchyIssues(
  req: PayloadRequest,
  categoryId: string | number | null | undefined,
  parentValue: RelationshipValue,
): Promise<RawIssue[]> {
  const parentId = relationshipID(parentValue)
  if (parentId === null) return []

  const categoryKey = categoryId === null || categoryId === undefined ? null : String(categoryId)
  if (categoryKey && String(parentId) === categoryKey) return blocker(ISSUE_CODES.categoryParentSelfReference)

  const visited = new Set<string>()
  let currentId: string | number | null = parentId

  for (let depth = 0; currentId !== null && depth < 100; depth += 1) {
    const currentKey = String(currentId)
    if (categoryKey && currentKey === categoryKey) return blocker(ISSUE_CODES.categoryParentCycle)
    if (visited.has(currentKey)) return blocker(ISSUE_CODES.categoryHierarchyExistingCycle)
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
      return blocker(ISSUE_CODES.categoryParentNotFound)
    }

    currentId = relationshipID(current.parent)
  }

  if (currentId !== null) return blocker(ISSUE_CODES.categoryHierarchyDepthExceeded)
  return []
}

export async function getCategoryHierarchyIssues(
  req: PayloadRequest,
  categoryId: string | number | null | undefined,
  parentValue: RelationshipValue,
): Promise<PublicationIssue[]> {
  return decorateIssues(await collectCategoryHierarchyIssues(req, categoryId, parentValue), 'category')
}
