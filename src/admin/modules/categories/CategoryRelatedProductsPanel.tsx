import type { PayloadRequest, Where } from 'payload'

import { countDocs, findDocs } from '../../views/shared'
import { CategoryProductsManager } from './CategoryProductsManager'
import type { RelatedProduct } from './types'

const VISIBLE_PRODUCTS = 50

export async function CategoryRelatedProductsPanel({
  req,
  categoryId,
}: {
  req: PayloadRequest
  categoryId: string | number
}) {
  const where = { categories: { contains: categoryId } } as Where
  const [productsResult, total] = await Promise.all([
    findDocs<RelatedProduct>(req, 'products', {
      sort: 'title',
      limit: VISIBLE_PRODUCTS,
      depth: 0,
      draft: true,
      where,
      select: { id: true, title: true, code: true, catalogStatus: true, availability: true, _status: true },
    }),
    countDocs(req, 'products', where),
  ])

  return <CategoryProductsManager categoryId={categoryId} products={productsResult.docs} total={total} />
}
