import Link from 'next/link'
import type React from 'react'

import { Status } from '../../design-system'
import { CategoryDetailEditor } from './CategoryDetailEditor'
import {
  categoryStatePills,
  type CategoryDetail,
  type CategoryMedia,
  type CategoryParent,
  type CategoryWorkspaceFilters,
} from './types'

type Props = {
  category: CategoryDetail
  filters: CategoryWorkspaceFilters
  categories: CategoryParent[]
  media: CategoryMedia[]
  termSuggestions: string[]
  relatedSection: React.ReactNode
  relatedTotal: number
}

function backHref(filters: CategoryWorkspaceFilters) {
  const params = new URLSearchParams()
  params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  if (filters.view && filters.view !== 'all') params.set('view', filters.view)
  return `/admin/categories?${params.toString()}`
}

export function CategoryDetailView({
  category,
  filters,
  categories,
  media,
  termSuggestions,
  relatedSection,
  relatedTotal,
}: Props) {
  return (
    <section className="esmera-category-detail" aria-label={`Detalhe de ${category.title || 'categoria'}`}>
      <header className="esmera-category-detail__header">
        <div>
          <Link className="esmera-category-back" href={backHref(filters)}>← Categorias</Link>
          <span className="esmera-eyebrow">Categoria</span>
          <h2>{category.title || 'Categoria sem título'}</h2>
          <p>{relatedTotal} produto{relatedTotal === 1 ? '' : 's'}</p>
        </div>
        <div className="esmera-category-detail__status">
          {categoryStatePills(category).map((pill) => <Status key={pill.label} tone={pill.tone}>{pill.label}</Status>)}
        </div>
      </header>

      <CategoryDetailEditor
        category={category}
        categories={categories}
        media={media}
        termSuggestions={termSuggestions}
        initialRevision={category.revision ?? null}
        initialUpdatedAt={category.updatedAt ?? null}
        relatedSection={relatedSection}
      />
    </section>
  )
}
