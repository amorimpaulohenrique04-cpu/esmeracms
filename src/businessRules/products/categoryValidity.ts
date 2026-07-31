import type { CollectionBeforeValidateHook, Where } from 'payload'

import { relationshipID } from '../relationships'

type ProductState = {
  catalogStatus?: string | null
  categories?: unknown[] | null
}

async function getActiveProductCategoryIssues(
  req: Parameters<CollectionBeforeValidateHook>[0]['req'],
  product: ProductState,
) {
  if (product.catalogStatus !== 'active') return []

  const categoryIds = Array.from(new Set(
    (product.categories || [])
      .map((value) => relationshipID(value as never))
      .filter((value): value is string | number => value !== null),
  ))

  if (!categoryIds.length) return []

  const where: Where = {
    and: [
      { id: { in: categoryIds } },
      { status: { equals: 'active' } },
      { _status: { equals: 'published' } },
    ],
  }

  const valid = await req.payload.find({
    collection: 'categories',
    depth: 0,
    limit: Math.max(1, categoryIds.length),
    pagination: false,
    draft: false,
    overrideAccess: true,
    req,
    where,
  })

  const validIds = new Set(valid.docs.map((category) => String(category.id)))
  return categoryIds.some((id) => !validIds.has(String(id)))
    ? ['Todo produto ativo precisa apontar somente para categorias ativas e publicadas.']
    : []
}

/**
 * Enriches the existing Products readiness hook with category-state issues without
 * persisting an extra schema field. The base hook remains the single authority for
 * publicationReady/publicationIssues and published-document rejection.
 */
export function withActiveProductCategoryValidity(
  baseHooks: CollectionBeforeValidateHook[],
): CollectionBeforeValidateHook {
  return async (args) => {
    const source = { ...((args.originalDoc || {}) as Record<string, unknown>), ...((args.data || {}) as Record<string, unknown>) }
    const categoryIssues = await getActiveProductCategoryIssues(args.req, source as ProductState)
    let nextData = { ...((args.data || {}) as Record<string, unknown>), categoryIssues }

    for (const hook of baseHooks) {
      const result = await hook({ ...args, data: nextData as typeof args.data })
      if (result) nextData = result as Record<string, unknown>
    }

    delete nextData.categoryIssues
    return nextData as typeof args.data
  }
}
