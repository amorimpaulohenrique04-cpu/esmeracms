import Link from 'next/link'
import type { PayloadRequest, Where } from 'payload'

import { DataTable, EmptyState, Status } from '../../design-system'
import { countDocs, findDocs } from '../../views/shared'
import type { RelatedProduct } from './types'

export async function CategoryRelatedProductsPanel({
  req,
  categoryId,
}: {
  req: PayloadRequest
  categoryId: string | number
}) {
  const [productsResult, relatedTotal] = await Promise.all([
    findDocs<RelatedProduct>(req, 'products', {
      sort: 'title',
      limit: 50,
      depth: 0,
      draft: true,
      where: { categories: { contains: categoryId } } as Where,
      select: { id: true, title: true, code: true, catalogStatus: true, availability: true, _status: true },
    }),
    countDocs(req, 'products', { categories: { contains: categoryId } } as Where),
  ])

  const relatedProducts = productsResult.docs

  return (
    <div className="esmera-category-related">
      <div className="esmera-category-related__intro">
        <div><span className="esmera-eyebrow">Relação derivada</span><h3>Produtos relacionados</h3></div>
        <p>Esta lista vem de <code>Products.categories</code>. Nenhum array de produtos é armazenado na categoria.</p>
      </div>
      {relatedProducts.length ? (
        <DataTable label="Produtos relacionados à categoria">
          <thead><tr><th>Produto</th><th>Catálogo</th><th>Publicação</th><th>Disponibilidade</th></tr></thead>
          <tbody>
            {relatedProducts.map((product) => (
              <tr key={String(product.id)}>
                <td>
                  <Link className="esmera-row-title" href={`/admin/products?product=${product.id}&tab=overview`}>{product.title || 'Produto sem título'}</Link>
                  <small className="esmera-category-related__code">{product.code || 'Sem código'}</small>
                </td>
                <td><Status tone={product.catalogStatus === 'active' ? 'success' : 'neutral'}>{product.catalogStatus === 'active' ? 'Ativo' : 'Arquivado'}</Status></td>
                <td><Status tone={product._status === 'published' ? 'info' : 'neutral'}>{product._status === 'published' ? 'Publicado' : 'Rascunho'}</Status></td>
                <td>{product.availability || '—'}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : <EmptyState title="Nenhum produto relacionado" copy="A relação aparece automaticamente quando um produto usa esta categoria." />}
      {relatedTotal > relatedProducts.length ? <p className="esmera-category-related__more">Mostrando {relatedProducts.length} de {relatedTotal}. Use Produtos para filtrar a categoria completa.</p> : null}
    </div>
  )
}
