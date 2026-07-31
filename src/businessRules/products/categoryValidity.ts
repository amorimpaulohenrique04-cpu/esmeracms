import { ValidationError, type CollectionBeforeValidateHook, type Where } from 'payload'

import { relationshipID } from '../relationships'

export const enforceActiveProductCategories: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data

  const product = { ...(originalDoc || {}), ...data } as {
    id?: string | number
    _status?: string | null
    catalogStatus?: string | null
    categories?: unknown[] | null
  }

  if (product.catalogStatus !== 'active' || product._status !== 'published') return data

  const categoryIds = Array.from(new Set(
    (product.categories || [])
      .map((value) => relationshipID(value as never))
      .filter((value): value is string | number => value !== null),
  ))

  if (!categoryIds.length) return data

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
    select: { id: true },
  })

  const validIds = new Set(valid.docs.map((category) => String(category.id)))
  const invalidIds = categoryIds.filter((id) => !validIds.has(String(id)))
  if (!invalidIds.length) return data

  throw new ValidationError({
    collection: 'products',
    id: product.id,
    req,
    errors: [{
      path: 'categories',
      message: 'Todo produto ativo e publicado precisa apontar somente para categorias ativas e publicadas.',
    }],
  })
}
