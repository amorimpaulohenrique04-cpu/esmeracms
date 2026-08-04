import Link from 'next/link'

import { DataTable, EmptyState, Status } from '../../design-system'
import { CategoryDetailEditor } from './CategoryDetailEditor'
import {
  categoryStatusLabels,
  type CategoryDetail,
  type CategoryMedia,
  type CategoryParent,
  type CategoryTab,
  type CategoryWorkspaceFilters,
  type RelatedProduct,
} from './types'

type Props = {
  category: CategoryDetail
  tab: CategoryTab
  filters: CategoryWorkspaceFilters
  categories: CategoryParent[]
  media: CategoryMedia[]
  termSuggestions: string[]
  relatedProducts: RelatedProduct[]
  relatedTotal: number
}

const tabs: Array<{ id: CategoryTab; label: string }> = [
  { id: 'general', label: 'Geral' },
  { id: 'media', label: 'Mídia & SEO' },
  { id: 'products', label: 'Produtos relacionados' },
]

const operationalLabels: Record<string, string> = {
  draft: 'Rascunho',
  ready: 'Pronta',
  publishing: 'Publicando',
  pending_verification: 'Aguardando confirmação',
  published: 'Visível no site',
  published_but_unverified: 'Confirmação pendente',
  published_but_incompatible: 'Problema de compatibilidade',
  publish_reverted: 'Publicação desfeita',
  blocked: 'Bloqueada',
  conflict: 'Conflito',
  failed: 'Falhou',
}

function hrefFor(filters: CategoryWorkspaceFilters, categoryId: string | number, tab: CategoryTab) {
  const params = new URLSearchParams()
  params.set('category', String(categoryId))
  params.set('tab', tab)
  params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  return `/admin/categories?${params.toString()}`
}

function backHref(filters: CategoryWorkspaceFilters) {
  const params = new URLSearchParams()
  params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  return `/admin/categories?${params.toString()}`
}

function publicationLabel(category: CategoryDetail) {
  return operationalLabels[category.publicationOperationalStatus || ''] ||
    (category._status === 'published' ? 'Publicada no Payload' : 'Rascunho')
}

function publicationTone(category: CategoryDetail) {
  if (category.publicationOperationalStatus === 'published' || category.publicationOperationalStatus === 'publish_reverted') return 'success' as const
  if (category.publicationOperationalStatus === 'published_but_incompatible' || category.publicationOperationalStatus === 'failed') return 'danger' as const
  if (category._status === 'published') return 'warning' as const
  return 'neutral' as const
}

export function CategoryDetailView({ category, tab, filters, categories, media, termSuggestions, relatedProducts, relatedTotal }: Props) {
  return (
    <section className="esmera-category-detail" aria-label={`Detalhe de ${category.title || 'categoria'}`}>
      <header className="esmera-category-detail__header">
        <div>
          <Link className="esmera-category-back" href={backHref(filters)}>← Categorias</Link>
          <span className="esmera-eyebrow">Categoria</span>
          <h2>{category.title || 'Categoria sem título'}</h2>
          <p>/{category.slug || 'sem-slug'} · ordem {category.order ?? '—'} · {relatedTotal} produto{relatedTotal === 1 ? '' : 's'}</p>
          {category.publicationTraceId ? <small>Referência técnica: {category.publicationTraceId}</small> : null}
        </div>
        <div className="esmera-category-detail__status">
          <Status tone={category.status === 'active' ? 'success' : 'neutral'}>{categoryStatusLabels[category.status || ''] || '—'}</Status>
          <Status tone={publicationTone(category)}>{publicationLabel(category)}</Status>
        </div>
      </header>

      <nav className="esmera-category-tabs" aria-label="Seções da categoria">
        {tabs.map((item) => <Link key={item.id} className={tab === item.id ? 'is-active' : ''} aria-current={tab === item.id ? 'page' : undefined} href={hrefFor(filters, category.id, item.id)}>{item.label}</Link>)}
      </nav>

      {tab === 'general' ? <CategoryDetailEditor category={category} categories={categories} media={media} termSuggestions={termSuggestions} section="general" initialRevision={category.revision ?? null} initialUpdatedAt={category.updatedAt ?? null} /> : null}
      {tab === 'media' ? <CategoryDetailEditor category={category} categories={categories} media={media} termSuggestions={termSuggestions} section="media" initialRevision={category.revision ?? null} initialUpdatedAt={category.updatedAt ?? null} /> : null}
      {tab === 'products' ? (
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
                    <td><Link className="esmera-row-title" href={`/admin/products?product=${product.id}&tab=overview`}>{product.title || 'Produto sem título'}</Link><small className="esmera-category-related__code">{product.code || 'Sem código'}</small></td>
                    <td><Status tone={product.catalogStatus === 'active' ? 'success' : 'neutral'}>{product.catalogStatus === 'active' ? 'Ativo' : 'Arquivado'}</Status></td>
                    <td><Status tone={product._status === 'published' ? 'info' : 'neutral'}>{product._status === 'published' ? 'Publicado no Payload' : 'Rascunho'}</Status></td>
                    <td>{product.availability || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : <EmptyState title="Nenhum produto relacionado" copy="A relação aparece automaticamente quando um produto usa esta categoria." />}
          {relatedTotal > relatedProducts.length ? <p className="esmera-category-related__more">Mostrando {relatedProducts.length} de {relatedTotal}. Use Produtos para filtrar a categoria completa.</p> : null}
        </div>
      ) : null}
    </section>
  )
}
